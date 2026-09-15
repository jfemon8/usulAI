import { DB_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { listAudit } from "@/lib/admin/audit";
import { feedbackSummary } from "@/lib/analytics/feedback";
import { getModelChain } from "@/lib/ai/providers";
import { getDb, getDocumentsCollection } from "@/lib/db/mongoClient";
import { STORAGE_STATE_ID } from "@/lib/maintenance/retention";
import { storageUsage } from "@/lib/maintenance/storage";
import { cloudinaryClient } from "@/lib/storage";
import { can, type BaseRole } from "@/lib/admin/roles";
import type { SourceType } from "@/types";

const DAY_MS = 86_400_000;

async function settled<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch {
    return null;
  }
}

async function corpusStats() {
  const documents = await getDocumentsCollection();
  const [bySource, embedded] = await Promise.all([
    Promise.all(
      SOURCE_PRIORITY.map(async (source: SourceType) => ({
        source,
        count: await documents.countDocuments({ sourceType: source }),
      })),
    ),
    documents.countDocuments({ embeddingModel: { $exists: true } }),
  ]);
  const total = bySource.reduce((sum, row) => sum + row.count, 0);
  return { total, embedded, bySource };
}

async function storageStats() {
  const usage = await storageUsage();
  return {
    usedBytes: usage.usedBytes,
    quotaBytes: usage.quotaBytes,
    ratio: usage.ratio,
    collections: [...usage.collections]
      .sort(
        (left, right) => right.dataBytes + right.indexBytes - (left.dataBytes + left.indexBytes),
      )
      .slice(0, 8)
      .map((row) => ({
        name: row.name,
        count: row.count,
        bytes: row.dataBytes + row.indexBytes,
      })),
  };
}

async function activityStats() {
  const db = await getDb();
  const logs = db.collection(DB_CONFIG.queryLogCollection);
  const now = Date.now();
  const day = new Date(now - DAY_MS);
  const week = new Date(now - 7 * DAY_MS);
  const [today, lastWeek, unansweredWeek, verified, scholar, maintenance] = await Promise.all([
    logs.countDocuments({ createdAt: { $gte: day } }),
    logs.countDocuments({ createdAt: { $gte: week } }),
    logs.countDocuments({
      createdAt: { $gte: week },
      $or: [{ answered: false }, { retrievedCount: 0 }],
    }),
    db.collection(DB_CONFIG.verifiedAnswerCollection).estimatedDocumentCount(),
    db.collection(DB_CONFIG.verifiedAnswerCollection).countDocuments({ origin: "scholar" }),
    db
      .collection<{ _id: string; checkedAt?: Date }>(DB_CONFIG.maintenanceCollection)
      .findOne({ _id: STORAGE_STATE_ID }),
  ]);
  return {
    questionsToday: today,
    questionsWeek: lastWeek,
    unansweredWeek,
    verifiedAnswers: verified,
    scholarAnswers: scholar,
    maintenanceCheckedAt: maintenance?.checkedAt?.toISOString() ?? null,
  };
}

interface CloudinaryUsage {
  plan?: string;
  resources?: number;
  storage?: { usage?: number };
  bandwidth?: { usage?: number };
  credits?: { usage?: number; limit?: number; used_percent?: number };
}

async function cloudinaryStats() {
  const usage = (await cloudinaryClient().api.usage()) as CloudinaryUsage;
  return {
    plan: usage.plan ?? null,
    resources: usage.resources ?? null,
    storageBytes: usage.storage?.usage ?? null,
    bandwidthBytes: usage.bandwidth?.usage ?? null,
    creditsUsed: usage.credits?.usage ?? null,
    creditsLimit: usage.credits?.limit ?? null,
  };
}

function modelStats() {
  const chain = getModelChain();
  return {
    attempts: chain.length,
    tiers: [...new Set(chain.map((entry) => entry.tier))],
  };
}

async function queueStats() {
  const db = await getDb();
  const [openReviews, openHelp, publishedMasail] = await Promise.all([
    db.collection(DB_CONFIG.reviewQueueCollection).countDocuments({ status: { $ne: "resolved" } }),
    db
      .collection(DB_CONFIG.helpRequestCollection)
      .countDocuments({ status: { $in: ["open", "claimed"] } }),
    db
      .collection(DB_CONFIG.verifiedAnswerCollection)
      .countDocuments({ origin: "scholar", published: true }),
  ]);
  return { openReviews, openHelp, publishedMasail };
}

export async function dashboardSnapshot(role: BaseRole) {
  const monitor = can(role, "monitor.view");
  const skip = Promise.resolve(null);
  const [corpus, storage, activity, feedback, cloudinary, audit, queues] = await Promise.all([
    monitor ? settled(corpusStats) : skip,
    monitor ? settled(storageStats) : skip,
    settled(activityStats),
    settled(feedbackSummary),
    monitor ? settled(cloudinaryStats) : skip,
    can(role, "audit.view") ? settled(() => listAudit({ limit: 8 })) : skip,
    settled(queueStats),
  ]);

  let models: ReturnType<typeof modelStats> | null = null;
  if (monitor) {
    try {
      models = modelStats();
    } catch {
      models = null;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    corpus,
    storage,
    activity,
    feedback,
    cloudinary,
    models,
    audit: audit?.items ?? [],
    queues,
  };
}

export type DashboardSnapshot = Awaited<ReturnType<typeof dashboardSnapshot>>;
