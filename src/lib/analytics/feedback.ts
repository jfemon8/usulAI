import { ObjectId } from "mongodb";
import { DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import type { AnswerSource, SourceType } from "@/types";

export type FeedbackVerdict = "helpful" | "unhelpful" | "wrong-citation";
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface FeedbackRecord {
  verdict: FeedbackVerdict;
  question: string;
  answer: string;
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

  const result = await feedback.insertOne({
    verdict: input.verdict,
    question: input.question.slice(0, 2000),
    answer: input.answer.slice(0, 8000),
    references: input.sources.map((source) => source.reference),
    sourcesUsed: [...new Set(input.sources.map((source) => source.sourceType))],
    note: input.note?.slice(0, 2000),
    status: input.verdict === "helpful" ? "approved" : "pending",
    createdAt: new Date(),
  });

  return String(result.insertedId);
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
): Promise<boolean> {
  const feedback = await collection();

  const result = await feedback.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, reviewedAt: new Date(), reviewerNote } },
  );

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
