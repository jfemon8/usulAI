import { createUIMessageStream, createUIMessageStreamResponse, smoothStream, streamText } from "ai";
import { MODEL_ATTEMPT_CONFIG } from "@/config/site";
import { logQuery, summariseRetrieval } from "@/lib/analytics/queryLog";
import { detectQuestionLanguage } from "@/lib/ai/language";
import { getModelChain } from "@/lib/ai/providers";
import { rewriteQuery, type ConversationTurn } from "@/lib/ai/queryRewriter";
import { buildSystemPrompt, buildRagPrompt } from "@/lib/ai/prompt";
import { findVerifiedAnswer } from "@/lib/analytics/verifiedAnswers";
import { retrieveAnswerContext } from "@/lib/retrieval/search";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource, UsulUIMessage } from "@/types";

export const runtime = "nodejs";

const NO_CONTEXT_REPLY = `দুঃখিত, আপনার এই প্রশ্নের উত্তর দেওয়ার মতো কোনো দলিল আমার সংগ্রহে খুঁজে পাইনি।

আমি শুধু কুরআন, হাদিস, ইজমা, কিয়াস ও সীরাত থেকে পাওয়া দলিলের ভিত্তিতেই উত্তর দিই; দলিল ছাড়া নিজে থেকে কিছু বলি না।

প্রশ্নটি একটু ভিন্নভাবে বা আরও নির্দিষ্ট করে জিজ্ঞেস করে দেখতে পারেন। আর এই মাসআলার নির্ভরযোগ্য সমাধানের জন্য নিকটস্থ একজন যোগ্য আলেমের সাথে পরামর্শ করার অনুরোধ করছি।`;

const ALL_TIERS_FAILED_REPLY = `দুঃখিত, এই মুহূর্তে উত্তরটি তৈরি করা গেল না। আপনার প্রশ্নের সাথে সম্পর্কিত দলিলগুলো আমি খুঁজে পেয়েছি, কিন্তু সেগুলো গুছিয়ে লিখে দেওয়ার ধাপটি সাময়িকভাবে কাজ করছে না।

নিচে সূত্রগুলো দেওয়া আছে, চাইলে সেগুলো সরাসরি দেখে নিতে পারেন। আর কিছুক্ষণ পর প্রশ্নটি আবার করলে সাধারণত উত্তর পাওয়া যায়।`;

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

  const verified = history.length === 0 ? await findVerifiedAnswer(question) : null;

  if (verified) {
    return createUIMessageStreamResponse({
      stream: createUIMessageStream<UsulUIMessage>({
        execute: ({ writer }) => {
          const textId = crypto.randomUUID();
          writer.write({ type: "data-sources", id: "sources", data: verified.sources });
          writer.write({ type: "text-start", id: textId });
          writer.write({ type: "text-delta", id: textId, delta: verified.answer });
          writer.write({ type: "text-end", id: textId });
        },
      }),
    });
  }

  const { query, rewritten } = await rewriteQuery(question, history);

  const context = await retrieveAnswerContext(query);

  if (context.length === 0) {
    void logQuery({
      question,
      searchQuery: query,
      rewritten,
      historyTurns: history.length,
      language: detectQuestionLanguage(question),
      ...summariseRetrieval(context),
      answered: false,
    });

    return createUIMessageStreamResponse({
      stream: createUIMessageStream<UsulUIMessage>({
        execute: ({ writer }) => {
          const textId = crypto.randomUUID();
          writer.write({ type: "data-sources", id: "sources", data: [] });
          writer.write({ type: "text-start", id: textId });
          writer.write({ type: "text-delta", id: textId, delta: NO_CONTEXT_REPLY });
          writer.write({ type: "text-end", id: textId });
        },
      }),
    });
  }

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

      for (const [attempt, { tier, provider, modelId, model }] of chain.entries()) {
        const textId = crypto.randomUUID();
        let emitted = false;

        const controller = new AbortController();
        const stall = setTimeout(
          () => controller.abort(),
          MODEL_ATTEMPT_CONFIG.firstTokenTimeoutMs,
        );

        try {
          const result = streamText({
            model,
            system,
            prompt,
            maxRetries: MODEL_ATTEMPT_CONFIG.retries,
            abortSignal: controller.signal,
            experimental_transform: smoothStream({ chunking: "word", delayInMs: 12 }),
          });

          for await (const delta of result.textStream) {
            if (!emitted) {
              clearTimeout(stall);
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
              modelId,
              attempt: attempt + 1,
            });
            return;
          }

          lastError = new Error(`${provider}/${modelId} returned an empty stream`);
          logger.warn(`Attempt ${attempt + 1}/${chain.length} produced no output, trying next`, {
            tier,
            provider,
            modelId,
          });
        } catch (error) {
          lastError = error;
          logger.warn(`Attempt ${attempt + 1}/${chain.length} failed, trying next`, {
            tier,
            provider,
            modelId,
            error: String(error).slice(0, 200),
          });

          if (emitted) {
            writer.write({ type: "text-end", id: textId });
            throw error;
          }
        } finally {
          clearTimeout(stall);
        }
      }

      logger.error(`Every model attempt failed (${chain.length} tried)`, {
        attempts: chain.map((entry) => `${entry.provider}/${entry.modelId}`).join(", "),
        error: String(lastError).slice(0, 200),
      });

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

      const failureId = crypto.randomUUID();
      writer.write({ type: "text-start", id: failureId });
      writer.write({ type: "text-delta", id: failureId, delta: ALL_TIERS_FAILED_REPLY });
      writer.write({ type: "text-end", id: failureId });
    },
    onError: (error) => {
      logger.error("Chat stream failed across every model tier", { error: String(error) });
      return "উত্তর তৈরি করা যায়নি, কিছুক্ষণ পর আবার চেষ্টা করো।";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
