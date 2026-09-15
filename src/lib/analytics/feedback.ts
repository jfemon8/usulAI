import { ObjectId } from "mongodb";
import { DB_CONFIG, VERIFIED_ANSWER_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { saveVerifiedAnswer, withdrawAutoVerified } from "@/lib/analytics/verifiedAnswers";
import { recordRankingFeedback } from "@/lib/analytics/rankingSignals";
import { forgetLearnedTopic } from "@/lib/learning/forget";
import { topicKey } from "@/lib/learning/topicKey";
import type { AnswerSource, SourceType } from "@/types";

export type FeedbackVerdict = "helpful" | "unhelpful" | "wrong-citation";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type FeedbackOrigin = "explicit" | "implicit";

export interface FeedbackRecord {
  verdict: FeedbackVerdict;
  question: string;
  answer: string;
  sources: AnswerSource[];
  references: string[];
  sourcesUsed: SourceType[];
  note?: string;
  status: ReviewStatus;
  origin?: FeedbackOrigin;
  clientKey?: string;
  topic?: string;
  createdAt: Date;
  reviewedAt?: Date;
  reviewerNote?: string;
}

export interface FeedbackInput {
  verdict: FeedbackVerdict;
  question: string;
  answer: string;
  sources: AnswerSource[];
  note?: string;
  clientKey?: string;
  origin?: FeedbackOrigin;
}

async function collection() {
  const db = await getDb();
  return db.collection<FeedbackRecord>(DB_CONFIG.feedbackCollection);
}

export async function recordFeedback(input: FeedbackInput): Promise<string> {
  const feedback = await collection();

  const positive = input.verdict === "helpful";
  const origin = input.origin ?? "explicit";
  const topic = topicKey(input.question);
  await recordRankingFeedback(input.question, input.sources, positive, origin === "implicit");

  const result = await feedback.insertOne({
    verdict: input.verdict,
    question: input.question.slice(0, 2000),
    answer: input.answer.slice(0, 8000),
    sources: input.sources,
    references: input.sources.map((source) => source.reference),
    sourcesUsed: [...new Set(input.sources.map((source) => source.sourceType))],
    note: input.note?.slice(0, 2000),
    status: input.verdict === "helpful" ? "approved" : "pending",
    origin,
    ...(input.clientKey ? { clientKey: input.clientKey } : {}),
    ...(topic ? { topic } : {}),
    createdAt: new Date(),
  });

  if (positive && origin === "explicit") await autoVerifyIfTrusted(input);
  if (!positive) await selfCorrect(input.question);

  return String(result.insertedId);
}

async function selfCorrect(question: string): Promise<void> {
  await withdrawAutoVerified(question);
  await forgetLearnedTopic(topicKey(question));
}

export function distinctSupporters(rows: { clientKey?: string; _id?: unknown }[]): number {
  return new Set(rows.map((row) => row.clientKey ?? String(row._id))).size;
}

async function autoVerifyIfTrusted(input: FeedbackInput): Promise<void> {
  const feedback = await collection();
  const question = input.question.trim();
  const topic = topicKey(question);
  const sameQuestion = topic ? { $or: [{ question }, { topic }] } : { question };

  const [helpful, negatives] = await Promise.all([
    feedback
      .find({ ...sameQuestion, verdict: "helpful", origin: { $ne: "implicit" } })
      .project<{ clientKey?: string; _id: unknown }>({ clientKey: 1 })
      .toArray(),
    feedback.countDocuments({ ...sameQuestion, verdict: { $ne: "helpful" } }),
  ]);

  const supporters = distinctSupporters(helpful);
  if (negatives > 0 || supporters < VERIFIED_ANSWER_CONFIG.autoVerifyAfterPositives) return;

  await saveVerifiedAnswer({
    question: input.question,
    answer: input.answer,
    sources: input.sources,
    origin: "auto",
    reviewerNote: `স্বয়ংক্রিয়ভাবে যাচাইকৃত (${supporters} জন ইউজার সহায়ক বলেছেন)`,
  });
}

export async function listReviewQueue(limit = 50): Promise<(FeedbackRecord & { id: string })[]> {
  const feedback = await collection();

  const rows = await feedback
    .find({ status: "pending" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return rows.map((row) => ({ ...row, id: String(row._id) }));
}

export async function resolveReview(
  id: string,
  status: Exclude<ReviewStatus, "pending">,
  reviewerNote?: string,
  correctedAnswer?: string,
): Promise<boolean> {
  const feedback = await collection();
  const record = await feedback.findOne({ _id: new ObjectId(id) });

  if (!record) return false;

  const result = await feedback.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, reviewedAt: new Date(), reviewerNote } },
  );

  if (status === "rejected") {
    await recordRankingFeedback(record.question, record.sources ?? [], false);
    await selfCorrect(record.question);
  }

  if (status === "approved") {
    await saveVerifiedAnswer({
      question: record.question,
      answer: correctedAnswer ?? record.answer,
      sources: record.sources ?? [],
      reviewerNote,
      feedbackId: id,
      origin: "scholar",
    });
  }

  return result.modifiedCount === 1;
}

export async function feedbackSummary() {
  const feedback = await collection();

  const [helpful, unhelpful, wrongCitation, pending] = await Promise.all([
    feedback.countDocuments({ verdict: "helpful" }),
    feedback.countDocuments({ verdict: "unhelpful" }),
    feedback.countDocuments({ verdict: "wrong-citation" }),
    feedback.countDocuments({ status: "pending" }),
  ]);

  return { helpful, unhelpful, wrongCitation, pending };
}
