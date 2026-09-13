import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import {
  ANSWER_GATE_CONFIG,
  MODEL_ATTEMPT_CONFIG,
  RATE_LIMIT_CONFIG,
  SOURCE_TRANSLATION_CONFIG,
} from "@/config/site";
import { logQuery, summariseRetrieval, type GateRejection } from "@/lib/analytics/queryLog";
import { detectConversationLanguage } from "@/lib/ai/language";
import { getModelChain } from "@/lib/ai/providers";
import { rewriteQuery, type ConversationTurn } from "@/lib/ai/queryRewriter";
import { buildSystemPrompt, buildRagPrompt } from "@/lib/ai/prompt";
import { findVerifiedAnswer } from "@/lib/analytics/verifiedAnswers";
import { retrieveForQuestion } from "@/lib/retrieval/search";
import { previousSourceReferences } from "@/lib/retrieval/carryForward";
import { findChunksByReferences } from "@/lib/retrieval/vectorStore";
import { attachQuranNotes } from "@/lib/retrieval/quranNotes";
import {
  attachSourceTranslations,
  settleWithin,
  startMissingTranslations,
  withTranslation,
} from "@/lib/ai/sourceTranslation";
import { createRepetitionGuard } from "@/lib/ai/repetitionGuard";
import { createWordPacer } from "@/lib/ai/wordPacer";
import { validateAnswer, type GateInput } from "@/lib/ai/answerGate";
import { preferredGrade } from "@/lib/ai/hadithGrade";
import { sanitizeSourceContent, splitSourceBlocks } from "@/lib/ingestion/translations";
import { createQuoteEnricher, enrichAnswer, type EnricherOptions } from "@/lib/ai/quoteEnricher";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { runAfterResponse } from "@/lib/utils/afterResponse";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource, RetrievedChunk, UsulUIMessage } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

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

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const deadline = Date.now() + MODEL_ATTEMPT_CONFIG.requestBudgetMs;
  const limit = await consumeRateLimit("chat", request);
  if (!limit.allowed) return rateLimitResponse(limit);

  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  if (!body || !Array.isArray(body.messages)) {
    return jsonError("অনুরোধটি সঠিক নয়।", 400);
  }

  const messages = (body.messages as UsulUIMessage[]).slice(-RATE_LIMIT_CONFIG.maxMessages);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  if (!lastUserMessage) {
    return jsonError("কোনো প্রশ্ন পাওয়া যায়নি।", 400);
  }

  const question = extractText(lastUserMessage);

  if (question.trim().length === 0) {
    return jsonError("কোনো প্রশ্ন পাওয়া যায়নি।", 400);
  }

  if (question.length > RATE_LIMIT_CONFIG.maxQuestionChars) {
    return jsonError(
      `প্রশ্নটি অনেক বড়। অনুগ্রহ করে ${RATE_LIMIT_CONFIG.maxQuestionChars} অক্ষরের মধ্যে সংক্ষেপে লিখুন।`,
      413,
    );
  }
  const history = toHistory(messages);
  const language = detectConversationLanguage(
    question,
    history.filter((turn) => turn.role === "user").map((turn) => turn.text),
  );

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

  const carried =
    history.length > 0 ? await findChunksByReferences(previousSourceReferences(messages)) : [];
  const retrieval = await retrieveForQuestion(question, query, { carried });
  const context = await attachSourceTranslations(await attachQuranNotes(retrieval.context));

  if (context.length === 0) {
    void logQuery({
      question,
      searchQuery: query,
      rewritten,
      historyTurns: history.length,
      ...(retrieval.scopedTo ? { scopedTo: retrieval.scopedTo } : {}),
      language,
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
  const gateInput: GateInput = {
    contextTexts: context.map((chunk) => sanitizeSourceContent(chunk.content)),
    references: context.map((chunk) => chunk.citation.reference),
    question,
    language,
  };
  const contextText = gateInput.contextTexts.join("\n\n");
  const enrichmentFor = (chunks: RetrievedChunk[]): EnricherOptions => ({
    sources: chunks.map((chunk, index) => ({
      index: index + 1,
      reference: chunk.citation.reference,
      ...splitSourceBlocks(chunk.content),
      ...(chunk.vocalized ? { arabic: chunk.vocalized } : {}),
      ...(chunk.machineTranslated ? { machineTranslated: true } : {}),
      ...(chunk.segments ? { segments: chunk.segments } : {}),
    })),
    language: gateInput.language,
  });
  let enrichmentOptions = enrichmentFor(context);

  const translations = startMissingTranslations(context);
  if (translations.jobs.length > 0) runAfterResponse(() => Promise.allSettled(translations.jobs));
  const translationsReady = settleWithin(
    translations.jobs,
    SOURCE_TRANSLATION_CONFIG.responseWaitMs,
  ).then(() => {
    if (translations.results.size === 0) return;
    enrichmentOptions = enrichmentFor(
      context.map((chunk) => {
        const translation = translations.results.get(chunk.id);
        return translation ? withTranslation(chunk, translation) : chunk;
      }),
    );
  });
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
    grade: preferredGrade(chunk.grades),
  }));

  const stream = createUIMessageStream<UsulUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "data-sources", id: "sources", data: sources });

      let lastError: unknown;
      const gateRejections: GateRejection[] = [];

      for (const [attempt, { tier, provider, modelId, model }] of chain.entries()) {
        const remaining = deadline - Date.now();

        if (remaining < MODEL_ATTEMPT_CONFIG.minAttemptMs) {
          lastError = new Error(
            `request time budget spent after ${attempt} of ${chain.length} attempts`,
          );
          logger.warn(`Stopping before attempt ${attempt + 1}/${chain.length}: time budget spent`, {
            remainingMs: remaining,
          });
          break;
        }

        const textId = crypto.randomUUID();
        let emitted = false;

        const controller = new AbortController();
        const budget = setTimeout(() => controller.abort(), remaining);
        let stall: ReturnType<typeof setTimeout> | undefined;

        const gated = !ANSWER_GATE_CONFIG.trustedModels.includes(modelId);
        let streamError: unknown;
        const pacer = createWordPacer({
          write: (chunk) => writer.write({ type: "text-delta", id: textId, delta: chunk }),
        });

        try {
          const result = streamText({
            model,
            system,
            prompt,
            maxRetries: MODEL_ATTEMPT_CONFIG.retries,
            abortSignal: controller.signal,
            onError: ({ error }) => {
              streamError = error;
            },
          });

          await translationsReady;
          stall = setTimeout(
            () => controller.abort(),
            Math.min(MODEL_ATTEMPT_CONFIG.firstTokenTimeoutMs, Math.max(0, deadline - Date.now())),
          );

          const guard = createRepetitionGuard(contextText);

          const send = (piece: string) => {
            if (piece.length === 0) return;
            if (!emitted) {
              writer.write({ type: "text-start", id: textId });
              emitted = true;
            }
            pacer.push(piece);
          };

          if (gated) {
            let full = "";

            for await (const delta of result.textStream) {
              clearTimeout(stall);
              full += delta;
            }

            if (full.trim().length > 0) {
              const verdict = validateAnswer(full, gateInput);

              if (!verdict.ok) {
                gateRejections.push({ modelId, reasons: verdict.reasons });
                lastError = new Error(`${provider}/${modelId} rejected by the answer gate`);
                logger.warn(`Attempt ${attempt + 1}/${chain.length} rejected by the answer gate`, {
                  tier,
                  provider,
                  modelId,
                  reasons: verdict.reasons.join(" | "),
                });
                continue;
              }

              send(enrichAnswer(full, enrichmentOptions));
            }
          } else {
            const enricher = createQuoteEnricher(enrichmentOptions);

            for await (const delta of result.textStream) {
              clearTimeout(stall);
              const step = guard.push(delta);
              send(enricher.push(step.emit));
              if (step.stopped) break;
            }

            if (guard.wasCut()) {
              controller.abort();
              logger.warn(`Attempt ${attempt + 1}/${chain.length} started looping, answer cut`, {
                tier,
                provider,
                modelId,
              });
              send(enricher.flush());
            } else {
              send(enricher.push(guard.flush()));
              send(enricher.flush());
            }
          }

          if (emitted) {
            await pacer.finish();
            writer.write({ type: "text-end", id: textId });
            void logQuery({
              question,
              searchQuery: query,
              rewritten,
              historyTurns: history.length,
              ...(retrieval.scopedTo ? { scopedTo: retrieval.scopedTo } : {}),
              language,
              ...summariseRetrieval(context),
              answered: true,
              modelTier: tier,
              modelId,
              attempt: attempt + 1,
              loopCut: guard.wasCut(),
              gateRejections: gateRejections.length > 0 ? gateRejections : undefined,
            });
            return;
          }

          lastError = streamError ?? new Error(`${provider}/${modelId} returned an empty stream`);
          logger.warn(`Attempt ${attempt + 1}/${chain.length} produced no output, trying next`, {
            tier,
            provider,
            modelId,
            ...(streamError ? { error: String(streamError).slice(0, 200) } : {}),
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
            await pacer.finish();
            writer.write({ type: "text-end", id: textId });
            if (controller.signal.aborted && Date.now() >= deadline - 1000) {
              logger.warn("Answer cut at the request time budget", { tier, provider, modelId });
              return;
            }
            throw error;
          }
        } finally {
          clearTimeout(stall);
          clearTimeout(budget);
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
        ...(retrieval.scopedTo ? { scopedTo: retrieval.scopedTo } : {}),
        language,
        ...summariseRetrieval(context),
        answered: false,
        errorTier: chain[chain.length - 1]?.tier,
        gateRejections: gateRejections.length > 0 ? gateRejections : undefined,
      });

      writer.write({ type: "data-outcome", id: "outcome", data: { retryable: true } });
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
