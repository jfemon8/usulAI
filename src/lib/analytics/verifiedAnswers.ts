import { DB_CONFIG, VERIFIED_ANSWER_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource } from "@/types";

export interface VerifiedAnswer {
  question: string;
  normalizedQuestion: string;
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
}): Promise<void> {
  const verified = await collection();
  const normalizedQuestion = normalizeQuestion(input.question);

  await verified.updateOne(
    { normalizedQuestion },
    {
      $set: {
        question: input.question,
        normalizedQuestion,
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

  logger.info("Stored scholar-verified answer", { question: input.question.slice(0, 80) });
}

export async function findVerifiedAnswer(question: string): Promise<VerifiedAnswer | null> {
  if (!VERIFIED_ANSWER_CONFIG.enabled) return null;

  try {
    const verified = await collection();
    const normalizedQuestion = normalizeQuestion(question);

    const exact = await verified.findOne({ normalizedQuestion });
    if (!exact) return null;

    await verified.updateOne({ normalizedQuestion }, { $inc: { servedCount: 1 } });
    return exact;
  } catch (error) {
    logger.warn("Verified answer lookup failed", { error: String(error).slice(0, 160) });
    return null;
  }
}

export async function listVerifiedAnswers(limit = 100) {
  const verified = await collection();
  return verified.find().sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function deleteVerifiedAnswer(normalizedQuestion: string): Promise<boolean> {
  const verified = await collection();
  const { deletedCount } = await verified.deleteOne({ normalizedQuestion });
  return deletedCount === 1;
}
