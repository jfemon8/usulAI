import { ObjectId } from "mongodb";
import { DB_CONFIG, VERIFIED_ANSWER_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { saveVerifiedAnswer } from "@/lib/analytics/verifiedAnswers";
import { recordRankingFeedback } from "@/lib/analytics/rankingSignals";
import type { AnswerSource, SourceType } from "@/types";

export type FeedbackVerdict = "helpful" | "unhelpful" | "wrong-citation";
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface FeedbackRecord {
  verdict: FeedbackVerdict;
  question: string;
  answer: string;
  sources: AnswerSource[];
  references: string[];
  sourcesUsed: SourceType[];
  note?: string;
  status: ReviewStatus;
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
}

async function collection() {
  const db = await getDb();
  return db.collection<FeedbackRecord>(DB_CONFIG.feedbackCollection);
}

export async function recordFeedback(input: FeedbackInput): Promise<string> {
  const feedback = await collection();

  const positive = input.verdict === "helpful";
  await recordRankingFeedback(input.question, input.sources, positive);

  const result = await feedback.insertOne({
    verdict: input.verdict,
    question: input.question.slice(0, 2000),
    answer: input.answer.slice(0, 8000),
    sources: input.sources,
    references: input.sources.map((source) => source.reference),
    sourcesUsed: [...new Set(input.sources.map((source) => source.sourceType))],
    note: input.note?.slice(0, 2000),
    status: input.verdict === "helpful" ? "approved" : "pending",
    createdAt: new Date(),
  });

  if (positive) await autoVerifyIfTrusted(input);

  return String(result.insertedId);
}

async function autoVerifyIfTrusted(input: FeedbackInput): Promise<void> {
  const feedback = await collection();
  const normalized = input.question.trim();

  const [positives, negatives] = await Promise.all([
    feedback.countDocuments({ question: normalized, verdict: "helpful" }),
    feedback.countDocuments({ question: normalized, verdict: { $ne: "helpful" } }),
  ]);

  if (negatives > 0 || positives < VERIFIED_ANSWER_CONFIG.autoVerifyAfterPositives) return;

  await saveVerifiedAnswer({
    question: input.question,
    answer: input.answer,
    sources: input.sources,
    reviewerNote: `স্বয়ংক্রিয়ভাবে যাচাইকৃত (${positives} জন ইউজার সহায়ক বলেছেন)`,
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
  }

  if (status === "approved") {
    await saveVerifiedAnswer({
      question: record.question,
      answer: correctedAnswer ?? record.answer,
      sources: record.sources ?? [],
      reviewerNote,
      feedbackId: id,
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
