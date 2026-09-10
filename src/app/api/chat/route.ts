import { createUIMessageStream, createUIMessageStreamResponse, smoothStream, streamText } from "ai";
import { logQuery, summariseRetrieval } from "@/lib/analytics/queryLog";
import { detectQuestionLanguage } from "@/lib/ai/language";
import { getModelChain } from "@/lib/ai/providers";
import { rewriteQuery, type ConversationTurn } from "@/lib/ai/queryRewriter";
import { buildSystemPrompt, buildRagPrompt } from "@/lib/ai/prompt";
import { retrieveAnswerContext } from "@/lib/retrieval/search";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource, UsulUIMessage } from "@/types";

export const runtime = "nodejs";

function extractText(message: UsulUIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function toHistory(messages: UsulUIMessage[]): ConversationTurn[] {
  return messages
    .slice(0, -1)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role === "user" ? ("user" as const) : ("assistant" as const),
      text: extractText(message),
    }))
    .filter((turn) => turn.text.trim().length > 0);
}

export async function POST(request: Request) {
  const { messages }: { messages: UsulUIMessage[] } = await request.json();
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  if (!lastUserMessage) {
    return new Response("No user message found.", { status: 400 });
  }

  const question = extractText(lastUserMessage);
  const history = toHistory(messages);
  const { query, rewritten } = await rewriteQuery(question, history);

  const context = await retrieveAnswerContext(query);
  const system = buildSystemPrompt();
  const prompt = buildRagPrompt(question, context, history);
  const chain = getModelChain();

  const sources: AnswerSource[] = context.map((chunk, index) => ({
    index: index + 1,
    sourceType: chunk.sourceType,
    reference: chunk.citation.reference,
    url: chunk.citation.url,
    media: chunk.citation.media,
    page: chunk.citation.page,
    pageCount: chunk.citation.pageCount,
    similarity: chunk.similarity,
  }));

  const stream = createUIMessageStream<UsulUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "data-sources", id: "sources", data: sources });

      let lastError: unknown;

      for (const { tier, provider, modelId, model } of chain) {
        const textId = crypto.randomUUID();
        let emitted = false;

        try {
          const result = streamText({
            model,
            system,
            prompt,
            experimental_transform: smoothStream({ chunking: "word", delayInMs: 12 }),
          });

          for await (const delta of result.textStream) {
            if (!emitted) {
              writer.write({ type: "text-start", id: textId });
              emitted = true;
            }
            writer.write({ type: "text-delta", id: textId, delta });
          }

          if (emitted) {
            writer.write({ type: "text-end", id: textId });
            void logQuery({
              question,
              searchQuery: query,
              rewritten,
              historyTurns: history.length,
              language: detectQuestionLanguage(question),
              ...summariseRetrieval(context),
              answered: true,
              modelTier: tier,
            });
            return;
          }

          lastError = new Error(`${provider}/${modelId} returned an empty stream`);
          logger.warn(`Model tier "${tier}" produced no output, trying next`, {
            provider,
            modelId,
          });
        } catch (error) {
          lastError = error;
          logger.warn(`Model tier "${tier}" failed, trying next`, {
            provider,
            modelId,
            error: String(error),
          });

          if (emitted) {
            writer.write({ type: "text-end", id: textId });
            throw error;
          }
        }
      }

      void logQuery({
        question,
        searchQuery: query,
        rewritten,
        historyTurns: history.length,
        language: detectQuestionLanguage(question),
        ...summariseRetrieval(context),
        answered: false,
        errorTier: chain[chain.length - 1]?.tier,
      });

      throw lastError ?? new Error("No model tier produced a response.");
    },
    onError: (error) => {
      logger.error("Chat stream failed across every model tier", { error: String(error) });
      return "উত্তর তৈরি করা যায়নি — কিছুক্ষণ পর আবার চেষ্টা করো।";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
