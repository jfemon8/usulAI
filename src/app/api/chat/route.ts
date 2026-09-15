import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import {
  ANSWER_GATE_CONFIG,
  MODEL_ATTEMPT_CONFIG,
  RATE_LIMIT_CONFIG,
  SOURCE_TRANSLATION_CONFIG,
} from "@/config/site";
import { logQuery, summariseRetrieval, type GateRejection } from "@/lib/analytics/queryLog";
import { detectConversationLanguage } from "@/lib/ai/language";
import { ANSWER_PRIORITY_HEADERS, getModelChain, type TieredModel } from "@/lib/ai/providers";
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
import { answerLanguageMatches, validateAnswer, type GateInput } from "@/lib/ai/answerGate";
import {
  answerOrder,
  isTransientFailure,
  recordModelFailure,
  recordModelSuccess,
} from "@/lib/ai/modelHealth";
import { preferredGrade } from "@/lib/ai/hadithGrade";
import { sanitizeSourceContent, splitSourceBlocks } from "@/lib/ingestion/translations";
import {
  createQuoteEnricher,
  type EnricherOptions,
  type EnrichmentSource,
} from "@/lib/ai/quoteEnricher";
import { findQuranVerse, quranVerseIndex } from "@/lib/retrieval/quranVerseIndex";
import { learnFromFollowUp } from "@/lib/learning/implicitFeedback";
import { preferReliable, recordModelOutcome, refreshModelStats } from "@/lib/learning/modelStats";
import { clientKey, consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { runAfterResponse } from "@/lib/utils/afterResponse";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource, RetrievedChunk, UsulUIMessage } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const NO_CONTEXT_REPLY = `দুঃখিত, আপনার এই প্রশ্নের উত্তর দেওয়ার মতো কোনো দলিল আমার সংগ্রহে খুঁজে পাইনি।

আমি শুধু কুরআন, হাদিস, ইজমা, কিয়াস, সীরাত ও ফিকহের কিতাব থেকে পাওয়া দলিলের ভিত্তিতেই উত্তর দিই; দলিল ছাড়া নিজে থেকে কিছু বলি না।

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

function toAnswerSource(source: EnrichmentSource): AnswerSource {
  return {
    index: source.index,
    sourceType: source.sourceType ?? "quran",
    reference: source.reference ?? "",
    ...(source.url ? { url: source.url } : {}),
    similarity: 0,
  };
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
  quranVerseIndex();
  const history = toHistory(messages);
  if (history.length > 0) void learnFromFollowUp(messages, clientKey(request));
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
    isVerifiedQuote: (run) => {
      const index = quranVerseIndex();
      return index !== null && findQuranVerse(index, run) !== null;
    },
  };
  const contextText = gateInput.contextTexts.join("\n\n");
  const resolveQuranQuote: EnricherOptions["resolveQuote"] = (run) => {
    const index = quranVerseIndex();
    const match = index ? findQuranVerse(index, run) : null;
    if (!match) return null;
    const { verse } = match;
    return {
      reference: verse.reference,
      arabic: verse.arabic,
      ...(verse.bangla ? { bangla: verse.bangla } : {}),
      ...(verse.english ? { english: verse.english } : {}),
      sourceType: "quran",
      url: `https://quran.com/${verse.surah}/${verse.ayah}`,
      segment: match.segment,
    };
  };
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
    strict: true,
    resolveQuote: resolveQuranQuote,
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
  const fullChain = getModelChain();
  const answerChain = fullChain.filter(
    (entry) => !ANSWER_GATE_CONFIG.excludedAnswerModels.includes(entry.modelId),
  );
  await refreshModelStats();
  const chain = preferReliable(answerOrder(answerChain.length > 0 ? answerChain : fullChain));

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

      let pending: TieredModel[] = chain;
      let attempt = -1;

      rounds: for (
        let round = 0;
        round <= MODEL_ATTEMPT_CONFIG.transientRetryRounds && pending.length > 0;
        round += 1
      ) {
        if (round > 0) {
          const waitMs = MODEL_ATTEMPT_CONFIG.transientRetryWaitMs;
          if (deadline - Date.now() < waitMs + MODEL_ATTEMPT_CONFIG.minAttemptMs) break;
          logger.info("Retrying models that were only rate limited or overloaded", {
            models: pending.map((entry) => entry.modelId).join(", "),
            waitMs,
          });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        const transient: TieredModel[] = [];

        for (const entry of pending) {
          const { tier, provider, modelId, model } = entry;
          attempt += 1;
          const remaining = deadline - Date.now();

          if (remaining < MODEL_ATTEMPT_CONFIG.minAttemptMs) {
            lastError = new Error(
              `request time budget spent after ${attempt} of ${chain.length} attempts`,
            );
            logger.warn(
              `Stopping before attempt ${attempt + 1}/${chain.length}: time budget spent`,
              {
                remainingMs: remaining,
              },
            );
            break rounds;
          }

          const textId = crypto.randomUUID();
          let emitted = false;

          const controller = new AbortController();
          const budget = setTimeout(() => controller.abort(), remaining);
          let stall: ReturnType<typeof setTimeout> | undefined;

          const gated = !ANSWER_GATE_CONFIG.trustedModels.includes(modelId);
          let addedSources: EnrichmentSource[] = [];
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
              ...(tier === "reserve" ? { headers: ANSWER_PRIORITY_HEADERS } : {}),
              onError: ({ error }) => {
                streamError = error;
              },
            });

            await translationsReady;
            const lastInChain = entry === pending[pending.length - 1];
            stall = setTimeout(
              () => controller.abort(),
              Math.min(
                lastInChain ? Number.POSITIVE_INFINITY : MODEL_ATTEMPT_CONFIG.firstTokenTimeoutMs,
                Math.max(0, deadline - Date.now()),
              ),
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
                  recordModelOutcome(modelId, "rejected");
                  gateRejections.push({ modelId, reasons: verdict.reasons });
                  recordModelOutcome(modelId, "rejected");
                  lastError = new Error(`${provider}/${modelId} rejected by the answer gate`);
                  logger.warn(
                    `Attempt ${attempt + 1}/${chain.length} rejected by the answer gate`,
                    {
                      tier,
                      provider,
                      modelId,
                      reasons: verdict.reasons.join(" | "),
                    },
                  );
                  continue;
                }

                const enricher = createQuoteEnricher(enrichmentOptions);
                send(enricher.push(full) + enricher.flush());
                addedSources = enricher.addedSources();
              }
            } else {
              const enricher = createQuoteEnricher(enrichmentOptions);
              let probe = "";
              let probing = true;
              let wrongLanguage = false;

              const release = (text: string) => {
                if (!probing) {
                  send(enricher.push(text));
                  return;
                }
                probe += text;
                const verdict = answerLanguageMatches(probe, language);
                if (verdict === null) return;
                probing = false;
                if (!verdict) {
                  wrongLanguage = true;
                  return;
                }
                send(enricher.push(probe));
              };

              for await (const delta of result.textStream) {
                clearTimeout(stall);
                const step = guard.push(delta);
                release(step.emit);
                if (wrongLanguage || step.stopped) break;
              }

              if (!wrongLanguage && !guard.wasCut()) release(guard.flush());

              if (!wrongLanguage && probing && probe.length > 0) {
                probing = false;
                if (answerLanguageMatches(probe, language, true) === false) wrongLanguage = true;
                else send(enricher.push(probe));
              }

              if (wrongLanguage) {
                controller.abort();
                gateRejections.push({
                  modelId,
                  reasons: [`language-mismatch: expected ${language}`],
                });
                lastError = new Error(`${provider}/${modelId} answered in the wrong language`);
                logger.warn(
                  `Attempt ${attempt + 1}/${chain.length} answered in the wrong language`,
                  {
                    tier,
                    provider,
                    modelId,
                  },
                );
                continue;
              }

              if (guard.wasCut()) {
                controller.abort();
                logger.warn(`Attempt ${attempt + 1}/${chain.length} started looping, answer cut`, {
                  tier,
                  provider,
                  modelId,
                });
              }
              send(enricher.flush());
              addedSources = enricher.addedSources();
            }

            if (emitted) {
              recordModelSuccess(modelId);
              recordModelOutcome(modelId, "answered");
              await pacer.finish();
              if (addedSources.length > 0) {
                writer.write({
                  type: "data-sources",
                  id: "sources",
                  data: [...sources, ...addedSources.map(toAnswerSource)],
                });
                logger.info(
                  "Verified a Quran quotation outside the context and added it as a source",
                  {
                    references: addedSources.map((source) => source.reference).join(", "),
                  },
                );
              }
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
            if (streamError) recordModelFailure(modelId, streamError);
            if (streamError && isTransientFailure(streamError)) transient.push(entry);
            logger.warn(`Attempt ${attempt + 1}/${chain.length} produced no output, trying next`, {
              tier,
              provider,
              modelId,
              ...(streamError ? { error: String(streamError).slice(0, 200) } : {}),
            });
          } catch (error) {
            lastError = error;
            recordModelFailure(modelId, streamError ?? error);
            if (!emitted && isTransientFailure(streamError ?? error)) transient.push(entry);
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

        pending = transient;
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
