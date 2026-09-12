import { DB_CONFIG, FEEDBACK_LEARNING_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { normalizeQuestion } from "@/lib/analytics/verifiedAnswers";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource, RetrievedChunk } from "@/types";

export interface RankingSignal {
  topic: string;
  reference: string;
  positive: number;
  negative: number;
  updatedAt: Date;
}

function topicKey(question: string): string {
  return normalizeQuestion(question).split(" ").slice(0, 6).join(" ");
}

async function collection() {
  const db = await getDb();
  return db.collection<RankingSignal>(DB_CONFIG.rankingSignalCollection);
}

export async function recordRankingFeedback(
  question: string,
  sources: AnswerSource[],
  positive: boolean,
): Promise<void> {
  if (!FEEDBACK_LEARNING_CONFIG.enabled || sources.length === 0) return;

  try {
    const signals = await collection();
    const topic = topicKey(question);
    const field = positive ? "positive" : "negative";

    await signals.bulkWrite(
      sources.map((source) => ({
        updateOne: {
          filter: { topic, reference: source.reference },
          update: { $inc: { [field]: 1 }, $set: { updatedAt: new Date() } },
          upsert: true,
        },
      })),
    );

    logger.info(`Recorded ${field} ranking signal`, { topic, count: sources.length });
  } catch (error) {
    logger.warn("Ranking signal write failed", { error: String(error).slice(0, 160) });
  }
}

export async function applyRankingSignals(
  question: string,
  context: RetrievedChunk[],
): Promise<RetrievedChunk[]> {
  if (!FEEDBACK_LEARNING_CONFIG.enabled || context.length === 0) return context;

  try {
    const signals = await collection();
    const rows = await signals
      .find({
        topic: topicKey(question),
        reference: { $in: context.map((chunk) => chunk.citation.reference) },
      })
      .toArray();

    if (rows.length === 0) return context;

    const byReference = new Map(rows.map((row) => [row.reference, row]));
    const { boostPerPositive, penaltyPerNegative, dropAtNetNegative } = FEEDBACK_LEARNING_CONFIG;

    const adjusted = context
      .map((chunk) => {
        const signal = byReference.get(chunk.citation.reference);
        if (!signal) return { chunk, net: 0, adjusted: chunk.similarity };

        const net = (signal.positive ?? 0) - (signal.negative ?? 0);
        const delta = net >= 0 ? net * boostPerPositive : net * penaltyPerNegative;

        return { chunk, net, adjusted: chunk.similarity + delta };
      })
      .filter((entry) => entry.net > dropAtNetNegative)
      .sort((a, b) => b.adjusted - a.adjusted)
      .map((entry) => entry.chunk);

    if (adjusted.length !== context.length) {
      logger.info(`Ranking signals dropped ${context.length - adjusted.length} chunks`);
    }

    return adjusted;
  } catch (error) {
    logger.warn("Ranking signal read failed", { error: String(error).slice(0, 160) });
    return context;
  }
}

export async function rankingSignalSummary() {
  const signals = await collection();

  const [topics, boosted, demoted] = await Promise.all([
    signals.distinct("topic").then((list) => list.length),
    signals.countDocuments({ $expr: { $gt: ["$positive", "$negative"] } }),
    signals.countDocuments({ $expr: { $lt: ["$positive", "$negative"] } }),
  ]);

  return { topics, boosted, demoted };
}
