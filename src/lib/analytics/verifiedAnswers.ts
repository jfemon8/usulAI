import { DB_CONFIG, VERIFIED_ANSWER_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { topicKey } from "@/lib/learning/topicKey";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource } from "@/types";

export type VerifiedOrigin = "auto" | "scholar";

export interface VerifiedAnswer {
  question: string;
  normalizedQuestion: string;
  topic?: string;
  origin?: VerifiedOrigin;
  answer: string;
  sources: AnswerSource[];
  reviewerNote?: string;
  feedbackId?: string;
  createdAt: Date;
  servedCount: number;
}

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function collection() {
  const db = await getDb();
  return db.collection<VerifiedAnswer>(DB_CONFIG.verifiedAnswerCollection);
}

export async function saveVerifiedAnswer(input: {
  question: string;
  answer: string;
  sources: AnswerSource[];
  reviewerNote?: string;
  feedbackId?: string;
  origin?: VerifiedOrigin;
}): Promise<void> {
  const verified = await collection();
  const normalizedQuestion = normalizeQuestion(input.question);

  await verified.updateOne(
    { normalizedQuestion },
    {
      $set: {
        question: input.question,
        normalizedQuestion,
        topic: topicKey(input.question),
        origin: input.origin ?? "scholar",
        answer: input.answer,
        sources: input.sources,
        reviewerNote: input.reviewerNote,
        feedbackId: input.feedbackId,
        createdAt: new Date(),
      },
      $setOnInsert: { servedCount: 0 },
    },
    { upsert: true },
  );

  logger.info("Stored verified answer", {
    origin: input.origin ?? "scholar",
    question: input.question.slice(0, 80),
  });
}

export async function findVerifiedAnswer(question: string): Promise<VerifiedAnswer | null> {
  if (!VERIFIED_ANSWER_CONFIG.enabled) return null;

  try {
    const verified = await collection();
    const normalizedQuestion = normalizeQuestion(question);

    const topic = topicKey(question);
    const match =
      (await verified.findOne({ normalizedQuestion })) ??
      (VERIFIED_ANSWER_CONFIG.matchByTopic && topic.includes(" ")
        ? await verified.findOne({ topic }, { sort: { origin: -1, createdAt: -1 } })
        : null);
    if (!match) return null;

    await verified.updateOne({ _id: match._id }, { $inc: { servedCount: 1 } });
    return match;
  } catch (error) {
    logger.warn("Verified answer lookup failed", { error: String(error).slice(0, 160) });
    return null;
  }
}

export async function listVerifiedAnswers(limit = 100) {
  const verified = await collection();
  return verified.find().sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function withdrawAutoVerified(question: string): Promise<number> {
  try {
    const verified = await collection();
    const { deletedCount } = await verified.deleteMany({
      origin: "auto",
      $or: [{ normalizedQuestion: normalizeQuestion(question) }, { topic: topicKey(question) }],
    });
    if (deletedCount > 0) {
      logger.info("Withdrew an automatically verified answer after negative feedback", {
        question: question.slice(0, 80),
      });
    }
    return deletedCount;
  } catch (error) {
    logger.warn("Verified answer withdrawal failed", { error: String(error).slice(0, 160) });
    return 0;
  }
}

export async function deleteVerifiedAnswer(normalizedQuestion: string): Promise<boolean> {
  const verified = await collection();
  const { deletedCount } = await verified.deleteOne({ normalizedQuestion });
  return deletedCount === 1;
}
