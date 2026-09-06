import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { getModelChain } from "@/lib/ai/providers";
import { buildSystemPrompt, buildRagPrompt } from "@/lib/ai/prompt";
import { retrieveAnswerContext } from "@/lib/retrieval/search";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource, UsulUIMessage } from "@/types";

export const runtime = "nodejs";

function extractText(message: UsulUIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export async function POST(request: Request) {
  const { messages }: { messages: UsulUIMessage[] } = await request.json();
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  if (!lastUserMessage) {
    return new Response("No user message found.", { status: 400 });
  }

  const question = extractText(lastUserMessage);
  const context = await retrieveAnswerContext(question);
  const system = buildSystemPrompt();
  const prompt = buildRagPrompt(question, context);
  const chain = getModelChain();

  const sources: AnswerSource[] = context.map((chunk, index) => ({
    index: index + 1,
    sourceType: chunk.sourceType,
    reference: chunk.citation.reference,
    url: chunk.citation.url,
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
          const result = streamText({ model, system, prompt });

          for await (const delta of result.textStream) {
            if (!emitted) {
              writer.write({ type: "text-start", id: textId });
              emitted = true;
            }
            writer.write({ type: "text-delta", id: textId, delta });
          }

          if (emitted) {
            writer.write({ type: "text-end", id: textId });
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

      throw lastError ?? new Error("No model tier produced a response.");
    },
    onError: (error) => {
      logger.error("Chat stream failed across every model tier", { error: String(error) });
      return "উত্তর তৈরি করা যায়নি — কিছুক্ষণ পর আবার চেষ্টা করো।";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
