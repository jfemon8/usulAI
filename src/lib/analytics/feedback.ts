import { createHash, randomUUID } from "crypto";
import { DB_CONFIG, VERIFIED_ANSWER_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import {
  normalizeQuestion,
  saveVerifiedAnswer,
  withdrawAutoVerified,
} from "@/lib/analytics/verifiedAnswers";
import { recordRankingFeedback } from "@/lib/analytics/rankingSignals";
import { forgetLearnedTopic } from "@/lib/learning/forget";
import { topicKey } from "@/lib/learning/topicKey";
import { enqueueReview } from "@/lib/reviews/queue";
import type { AnswerSource } from "@/types";

export type FeedbackVerdict = "helpful" | "unhelpful" | "wrong-citation";
export type FeedbackOrigin = "explicit" | "implicit";

export interface FeedbackInput {
  verdict: FeedbackVerdict;
  question: string;
  answer: string;
  sources: AnswerSource[];
  clientKey?: string;
  origin?: FeedbackOrigin;
  note?: string;
}

export interface FeedbackTally {
  _id: string;
  topic?: string;
  helpful?: number;
  unhelpful?: number;
  wrongCitation?: number;
  supporters?: string[];
  updatedAt: Date;
}

export interface TallyInput {
  verdict: FeedbackVerdict;
  question: string;
  origin: FeedbackOrigin;
  supporter: string;
}

const VERDICT_FIELDS = {
  helpful: "helpful",
  unhelpful: "unhelpful",
  "wrong-citation": "wrongCitation",
} as const satisfies Record<FeedbackVerdict, keyof FeedbackTally>;

export function tallyKey(question: string): string {
  const basis = topicKey(question) || normalizeQuestion(question);
  return createHash("sha256").update(basis).digest("base64url").slice(0, 22);
}

export function tallyUpdate(input: TallyInput, now: Date) {
  const counts = Object.fromEntries(
    Object.values(VERDICT_FIELDS).map((field) => [
      field,
      {
        $add: [{ $ifNull: [`$${field}`, 0] }, VERDICT_FIELDS[input.verdict] === field ? 1 : 0],
      },
    ]),
  );
  const existing = { $ifNull: ["$supporters", []] };
  const supports = input.verdict === "helpful" && input.origin === "explicit";
  const topic = topicKey(input.question);

  return [
    {
      $set: {
        ...counts,
        supporters: supports
          ? {
              $slice: [
                { $setUnion: [existing, { $literal: [input.supporter] }] },
                VERIFIED_ANSWER_CONFIG.autoVerifyAfterPositives,
              ],
            }
          : existing,
        ...(topic ? { topic } : {}),
        updatedAt: now,
      },
    },
  ];
}

export function isTrusted(
  tally: Pick<FeedbackTally, "unhelpful" | "wrongCitation" | "supporters">,
) {
  const negatives = (tally.unhelpful ?? 0) + (tally.wrongCitation ?? 0);
  return (
    negatives === 0 &&
    (tally.supporters?.length ?? 0) >= VERIFIED_ANSWER_CONFIG.autoVerifyAfterPositives
  );
}

async function tallies() {
  return (await getDb()).collection<FeedbackTally>(DB_CONFIG.feedbackTallyCollection);
}

export async function tallyFeedback(input: TallyInput): Promise<FeedbackTally | null> {
  return (await tallies()).findOneAndUpdate(
    { _id: tallyKey(input.question) },
    tallyUpdate(input, new Date()),
    { upsert: true, returnDocument: "after" },
  );
}

export async function recordFeedback(input: FeedbackInput): Promise<void> {
  const positive = input.verdict === "helpful";
  const origin = input.origin ?? "explicit";

  if (!positive) {
    await enqueueReview({
      verdict: input.verdict === "wrong-citation" ? "wrong-citation" : "unhelpful",
      question: input.question,
      answer: input.answer,
      sources: input.sources,
      origin,
      ...(input.note ? { note: input.note } : {}),
    });
  }

  await recordRankingFeedback(input.question, input.sources, positive, origin === "implicit");

  const tally = await tallyFeedback({
    verdict: input.verdict,
    question: input.question,
    origin,
    supporter: input.clientKey ?? randomUUID(),
  });

  if (!positive) {
    await withdrawAutoVerified(input.question);
    await forgetLearnedTopic(topicKey(input.question));
    return;
  }

  if (origin === "explicit" && tally && isTrusted(tally)) {
    await saveVerifiedAnswer({
      question: input.question,
      answer: input.answer,
      sources: input.sources,
      origin: "auto",
      reviewerNote: `স্বয়ংক্রিয়ভাবে যাচাইকৃত (${tally.supporters?.length ?? 0} জন ইউজার সহায়ক বলেছেন)`,
    });
  }
}

export async function feedbackSummary() {
  const [row] = await (
    await tallies()
  )
    .aggregate<{ helpful: number; unhelpful: number; wrongCitation: number; topics: number }>([
      {
        $group: {
          _id: null,
          helpful: { $sum: { $ifNull: ["$helpful", 0] } },
          unhelpful: { $sum: { $ifNull: ["$unhelpful", 0] } },
          wrongCitation: { $sum: { $ifNull: ["$wrongCitation", 0] } },
          topics: { $sum: 1 },
        },
      },
    ])
    .toArray();

  return {
    helpful: row?.helpful ?? 0,
    unhelpful: row?.unhelpful ?? 0,
    wrongCitation: row?.wrongCitation ?? 0,
    topics: row?.topics ?? 0,
  };
}
