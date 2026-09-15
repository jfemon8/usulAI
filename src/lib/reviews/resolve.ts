import { z } from "zod";
import { RATE_LIMIT_CONFIG } from "@/config/site";
import {
  ANSWER_LIMITS,
  answerSourceInput,
  resolveSources,
  validatedSources,
} from "@/lib/admin/answers";
import { recordRankingFeedback } from "@/lib/analytics/rankingSignals";
import { forgetLearnedTopic } from "@/lib/learning/forget";
import { topicKey } from "@/lib/learning/topicKey";
import { claimReview, removeReview, type Reviewer } from "@/lib/reviews/queue";
import { authorOf, publishScholarAnswer } from "@/lib/reviews/scholarAnswers";
import { logger } from "@/lib/utils/logger";

export const REVIEW_REASON_CHARS = 1_000;

export const resolutionInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    saveAsMasala: z.boolean().default(false),
    published: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("correct"),
    question: z.string().trim().min(1).max(RATE_LIMIT_CONFIG.maxQuestionChars),
    answer: z.string().trim().min(1).max(ANSWER_LIMITS.answerChars),
    sources: z.array(answerSourceInput).max(ANSWER_LIMITS.maxSources),
    published: z.boolean().default(false),
    reviewerNote: z.string().trim().max(ANSWER_LIMITS.reviewerNoteChars).default(""),
  }),
  z.object({
    action: z.literal("dismiss"),
    reason: z.string().trim().min(1).max(REVIEW_REASON_CHARS),
  }),
]);

export type ResolutionInput = z.infer<typeof resolutionInput>;

export interface ResolutionResult {
  action: ResolutionInput["action"];
  question: string;
  masalaId: string | null;
  published: boolean;
  detail: string;
}

export async function resolveReviewItem(
  id: string,
  input: ResolutionInput,
  reviewer: Reviewer,
): Promise<ResolutionResult> {
  const { item, takenFrom } = await claimReview(id, reviewer);
  const flagged = `flagged ${item.count}x (unhelpful ${item.unhelpful ?? 0}, wrong citation ${item.wrongCitation ?? 0})`;
  const takeover = takenFrom ? `; took over claim of ${takenFrom.email}` : "";
  let result: ResolutionResult;

  if (input.action === "confirm") {
    let masalaId: string | null = null;
    if (input.saveAsMasala) {
      const { sources } = await resolveSources(
        item.sources.map((source) => ({
          sourceType: source.sourceType,
          reference: source.reference,
        })),
      );
      const saved = await publishScholarAnswer({
        question: item.question.slice(0, RATE_LIMIT_CONFIG.maxQuestionChars),
        answer: item.answer,
        sources,
        published: input.published,
        author: authorOf(reviewer),
        reviewer,
        reuseOwn: true,
      });
      masalaId = saved.id;
    }
    await recordRankingFeedback(item.question, item.sources, true);
    result = {
      action: "confirm",
      question: item.question,
      masalaId,
      published: Boolean(masalaId) && input.published,
      detail: `${flagged}; ${masalaId ? `saved as masala ${masalaId}${input.published ? ", published" : ""}` : "not saved as masala"}${takeover}`,
    };
  } else if (input.action === "correct") {
    const sources = await validatedSources(input.sources);
    const saved = await publishScholarAnswer({
      question: input.question,
      answer: input.answer,
      sources,
      published: input.published,
      reviewerNote: input.reviewerNote,
      author: authorOf(reviewer),
      reviewer,
      reuseOwn: true,
    });
    const topics = new Set([topicKey(item.question), topicKey(input.question)]);
    for (const topic of topics) await forgetLearnedTopic(topic);
    result = {
      action: "correct",
      question: input.question,
      masalaId: saved.id,
      published: input.published,
      detail: `${flagged}; corrected as masala ${saved.id}, ${sources.length} sources${input.published ? ", published" : ""}${takeover}`,
    };
  } else {
    result = {
      action: "dismiss",
      question: item.question,
      masalaId: null,
      published: false,
      detail: `${flagged}; reason: ${input.reason}${takeover}`,
    };
  }

  const removed = await removeReview(id).catch((error: unknown) => {
    logger.warn("Resolved review item could not be removed", {
      error: String(error).slice(0, 160),
    });
    return null;
  });
  if (!removed) logger.info("Resolved review item was already gone", { id });
  return result;
}
