import { DB_CONFIG, RETENTION_CONFIG, STORAGE_BUDGET } from "@/config/site";
import { pretranslateFrequentPassages } from "@/lib/learning/pretranslate";
import { normalizeQuestion } from "@/lib/analytics/verifiedAnswers";
import { getDb, getDocumentsCollection } from "@/lib/db/mongoClient";
import { bytesToFree, storageUsage, type StorageUsage } from "@/lib/maintenance/storage";
import { logger } from "@/lib/utils/logger";

const DAY_MS = 86_400_000;
const ROLLUP_STATE_ID = "queryLogRollup";
export const STORAGE_STATE_ID = "storage";

export interface LogRow {
  question: string;
  language?: string;
  answered?: boolean;
  retrievedCount?: number;
  topScore?: number | null;
  createdAt: Date;
}

export interface Insight {
  question: string;
  language?: string;
  asked: number;
  answered: number;
  unanswered: number;
  emptyRetrieval: number;
  bestTopScore: number | null;
  firstAskedAt: Date;
  lastAskedAt: Date;
}

export function summariseLogs(rows: LogRow[]): Map<string, Insight> {
  const insights = new Map<string, Insight>();

  for (const row of rows) {
    const key = normalizeQuestion(row.question);
    if (!key) continue;

    const current = insights.get(key) ?? {
      question: row.question,
      language: row.language,
      asked: 0,
      answered: 0,
      unanswered: 0,
      emptyRetrieval: 0,
      bestTopScore: null,
      firstAskedAt: row.createdAt,
      lastAskedAt: row.createdAt,
    };

    current.asked += 1;
    if (row.answered) current.answered += 1;
    else current.unanswered += 1;
    if ((row.retrievedCount ?? 0) === 0) current.emptyRetrieval += 1;
    if (typeof row.topScore === "number") {
      current.bestTopScore = Math.max(current.bestTopScore ?? row.topScore, row.topScore);
    }
    if (row.createdAt < current.firstAskedAt) current.firstAskedAt = row.createdAt;
    if (row.createdAt > current.lastAskedAt) current.lastAskedAt = row.createdAt;

    insights.set(key, current);
  }

  return insights;
}

async function rollupQueryLogs(dryRun: boolean): Promise<number> {
  const db = await getDb();
  const state = db.collection<{ _id: string; until?: Date }>(DB_CONFIG.maintenanceCollection);
  const since = (await state.findOne({ _id: ROLLUP_STATE_ID }))?.until ?? new Date(0);
  const settled = new Date(Date.now() - 5 * 60_000);
  const maxRows = RETENTION_CONFIG.rollupBatchSize * 10;

  const rows = await db
    .collection<LogRow>(DB_CONFIG.queryLogCollection)
    .find(
      { createdAt: { $gt: since, $lte: settled } },
      {
        projection: {
          question: 1,
          language: 1,
          answered: 1,
          retrievedCount: 1,
          topScore: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ createdAt: 1 })
    .limit(maxRows)
    .toArray();

  const until = rows.length === maxRows ? (rows.at(-1)?.createdAt ?? settled) : settled;
  const insights = summariseLogs(rows);
  if (dryRun || insights.size === 0) return insights.size;

  const operations = [...insights].map(([key, insight]) => ({
    updateOne: {
      filter: { _id: key },
      update: {
        $inc: {
          asked: insight.asked,
          answered: insight.answered,
          unanswered: insight.unanswered,
          emptyRetrieval: insight.emptyRetrieval,
        },
        $min: { firstAskedAt: insight.firstAskedAt },
        $max: {
          lastAskedAt: insight.lastAskedAt,
          ...(insight.bestTopScore === null ? {} : { bestTopScore: insight.bestTopScore }),
        },
        $setOnInsert: { question: insight.question, language: insight.language },
      },
      upsert: true,
    },
  }));

  for (let start = 0; start < operations.length; start += RETENTION_CONFIG.rollupBatchSize) {
    await db
      .collection<{ _id: string }>(DB_CONFIG.queryInsightsCollection)
      .bulkWrite(operations.slice(start, start + RETENTION_CONFIG.rollupBatchSize), {
        ordered: false,
      });
  }

  await state.updateOne({ _id: ROLLUP_STATE_ID }, { $set: { until } }, { upsert: true });
  return insights.size;
}

async function capQueryEmbeddings(dryRun: boolean): Promise<number> {
  const collection = (await getDb()).collection<{ _id: string; lastUsedAt: Date }>(
    DB_CONFIG.queryEmbeddingCollection,
  );
  const excess = (await collection.estimatedDocumentCount()) - RETENTION_CONFIG.maxQueryEmbeddings;
  if (excess <= 0 || dryRun) return Math.max(0, excess);

  const oldest = await collection
    .find({}, { projection: { _id: 1 } })
    .sort({ lastUsedAt: 1 })
    .limit(excess)
    .toArray();

  return (await collection.deleteMany({ _id: { $in: oldest.map((row) => row._id) } })).deletedCount;
}

async function pruneOldPraise(dryRun: boolean): Promise<number> {
  const filter = {
    verdict: "helpful",
    status: "approved",
    createdAt: { $lt: new Date(Date.now() - RETENTION_CONFIG.resolvedFeedbackDays * DAY_MS) },
  };
  const collection = (await getDb()).collection(DB_CONFIG.feedbackCollection);
  return dryRun
    ? collection.countDocuments(filter)
    : (await collection.deleteMany(filter)).deletedCount;
}

async function pruneNeutralSignals(dryRun: boolean): Promise<number> {
  const filter = {
    updatedAt: { $lt: new Date(Date.now() - RETENTION_CONFIG.staleSignalDays * DAY_MS) },
    $expr: { $eq: ["$positive", "$negative"] },
  };
  const collection = (await getDb()).collection(DB_CONFIG.rankingSignalCollection);
  return dryRun
    ? collection.countDocuments(filter)
    : (await collection.deleteMany(filter)).deletedCount;
}

async function recentlyUsedReferences(): Promise<Set<string>> {
  const db = await getDb();
  const [fromLogs, fromVerified] = await Promise.all([
    db.collection(DB_CONFIG.queryLogCollection).distinct("references"),
    db.collection(DB_CONFIG.verifiedAnswerCollection).distinct("sources.reference"),
  ]);
  return new Set([...fromLogs, ...fromVerified].map(String));
}

async function evictUnusedEmbeddings(usage: StorageUsage, dryRun: boolean): Promise<number> {
  const needed = bytesToFree(usage.usedBytes, usage.quotaBytes);
  if (needed === 0) return 0;

  const limit = Math.min(
    Math.ceil(needed / STORAGE_BUDGET.vectorBytesPerDocument),
    STORAGE_BUDGET.maxEvictionsPerRun,
  );
  const keep = await recentlyUsedReferences();
  const documents = await getDocumentsCollection();

  const candidates: unknown[] = [];
  for await (const doc of documents.find(
    { embeddingModel: { $exists: true } },
    { projection: { "citation.reference": 1 } },
  )) {
    if (!keep.has(doc.citation.reference)) candidates.push(doc._id);
    if (candidates.length >= limit) break;
  }

  if (dryRun || candidates.length === 0) return candidates.length;

  const result = await documents.updateMany(
    { _id: { $in: candidates as never[] } },
    { $unset: { embedding: "", embeddingModel: "" } },
  );
  logger.warn(`Storage pressure: evicted ${result.modifiedCount} embeddings of unused documents`);
  return result.modifiedCount;
}

export interface MaintenanceReport {
  usedBefore: number;
  usedAfter: number;
  ratio: number;
  insightsRolledUp: number;
  queryEmbeddingsCapped: number;
  feedbackPruned: number;
  signalsPruned: number;
  embeddingsEvicted: number;
  passagesPretranslated: number;
  dryRun: boolean;
}

export async function runMaintenance(
  options: { dryRun?: boolean } = {},
): Promise<MaintenanceReport> {
  const dryRun = options.dryRun ?? false;
  const before = await storageUsage();

  const insightsRolledUp = await rollupQueryLogs(dryRun);
  const queryEmbeddingsCapped = await capQueryEmbeddings(dryRun);
  const feedbackPruned = await pruneOldPraise(dryRun);
  const signalsPruned = await pruneNeutralSignals(dryRun);
  const pressure = dryRun ? before : await storageUsage();
  const embeddingsEvicted = await evictUnusedEmbeddings(pressure, dryRun);

  const passagesPretranslated = await pretranslateFrequentPassages(dryRun);
  const after = dryRun ? before : await storageUsage();

  if (!dryRun) {
    const db = await getDb();
    await db
      .collection<{ _id: string }>(DB_CONFIG.maintenanceCollection)
      .updateOne(
        { _id: STORAGE_STATE_ID },
        { $set: { ratio: after.ratio, usedBytes: after.usedBytes, checkedAt: new Date() } },
        { upsert: true },
      );
  }

  return {
    usedBefore: before.usedBytes,
    usedAfter: after.usedBytes,
    ratio: after.ratio,
    insightsRolledUp,
    queryEmbeddingsCapped,
    feedbackPruned,
    signalsPruned,
    embeddingsEvicted,
    passagesPretranslated,
    dryRun,
  };
}
