import { z } from "zod";
import { DB_CONFIG, RATE_LIMIT_CONFIG, SELF_LEARNING_CONFIG, STORAGE_BUDGET } from "@/config/site";
import { AdminError } from "@/lib/admin/errors";
import { isModelCoolingDown, resetModelHealth } from "@/lib/ai/modelHealth";
import { describeModelChain } from "@/lib/ai/providers";
import { getDb } from "@/lib/db/mongoClient";
import { forgetRewrites } from "@/lib/ai/queryRewriter";
import { forgetLearnedTopic } from "@/lib/learning/forget";
import { listMemory, type MemoryDoc } from "@/lib/learning/memory";
import { successRatio } from "@/lib/learning/modelStats";
import { topicKey } from "@/lib/learning/topicKey";
import {
  runMaintenance,
  STORAGE_STATE_ID,
  type MaintenanceReport,
} from "@/lib/maintenance/retention";
import { storageUsage } from "@/lib/maintenance/storage";
import { forgetVerdicts } from "@/lib/retrieval/rerank";
import { windowIndex } from "@/lib/security/rateLimit";
import { aiSettingsSnapshot } from "@/lib/site/aiSettings";

const LEARNED_KINDS = ["rewrite", "verdict"] as const;
const RECENT_TOPIC_SCAN = 200;
const RECENT_TOPICS = 30;
const RATE_LIMIT_SCAN = 500;
const CLIENTS_PER_SCOPE = 10;

async function settled<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch {
    return null;
  }
}

export async function storageSummary() {
  const db = await getDb();
  const [usage, state] = await Promise.all([
    storageUsage(),
    db
      .collection<{ _id: string; checkedAt?: Date }>(DB_CONFIG.maintenanceCollection)
      .findOne({ _id: STORAGE_STATE_ID }, { projection: { checkedAt: 1 } }),
  ]);
  return {
    usedBytes: usage.usedBytes,
    dataBytes: usage.dataBytes,
    indexBytes: usage.indexBytes,
    quotaBytes: usage.quotaBytes,
    ratio: usage.ratio,
    collectionCount: usage.collections.length,
    warnRatio: STORAGE_BUDGET.warnRatio,
    evictAtRatio: STORAGE_BUDGET.evictAtRatio,
    targetRatio: STORAGE_BUDGET.targetRatio,
    lastMaintenanceAt: state?.checkedAt?.toISOString() ?? null,
  };
}

export type StorageSummary = Awaited<ReturnType<typeof storageSummary>>;

export async function runMaintenanceNow(dryRun: boolean): Promise<MaintenanceReport> {
  return runMaintenance({ dryRun });
}

interface ModelCounters {
  answered?: number;
  rejected?: number;
}

export interface ModelHealthRow {
  modelId: string;
  tier: string | null;
  provider: string | null;
  keyConfigured: boolean;
  disabled: boolean;
  inChain: boolean;
  coolingDown: boolean;
  answered: number;
  rejected: number;
  successRatio: number | null;
  demoted: boolean;
}

export function modelHealthRows(
  chain: { modelId: string; tier: string; provider: string; keyConfigured: boolean }[],
  stats: MemoryDoc<ModelCounters>[],
  options: { disabled: readonly string[]; cooling: (modelId: string) => boolean },
): ModelHealthRow[] {
  const counters = new Map(stats.map((row) => [row.topic ?? "", row.value ?? {}]));
  const row = (modelId: string, entry: (typeof chain)[number] | undefined): ModelHealthRow => {
    const value = counters.get(modelId);
    const ratio = successRatio(value);
    return {
      modelId,
      tier: entry?.tier ?? null,
      provider: entry?.provider ?? null,
      keyConfigured: entry?.keyConfigured ?? false,
      disabled: options.disabled.includes(modelId),
      inChain: entry !== undefined,
      coolingDown: options.cooling(modelId),
      answered: value?.answered ?? 0,
      rejected: value?.rejected ?? 0,
      successRatio: ratio,
      demoted: ratio !== null && ratio < SELF_LEARNING_CONFIG.modelDemoteBelowSuccess,
    };
  };
  const known = new Set(chain.map((entry) => entry.modelId));
  return [
    ...chain.map((entry) => row(entry.modelId, entry)),
    ...[...counters.keys()]
      .filter((modelId) => modelId && !known.has(modelId))
      .sort()
      .map((modelId) => row(modelId, undefined)),
  ];
}

export async function modelHealthSnapshot(now = Date.now()) {
  const stats = await listMemory<ModelCounters>("model");
  return {
    models: modelHealthRows(describeModelChain(), stats, {
      disabled: aiSettingsSnapshot().disabledModels,
      cooling: (modelId) => isModelCoolingDown(modelId, now),
    }),
    minAttempts: SELF_LEARNING_CONFIG.modelMinAttempts,
    demoteBelow: SELF_LEARNING_CONFIG.modelDemoteBelowSuccess,
  };
}

export function clearModelCooldowns(now = Date.now()): number {
  const cooling = describeModelChain().filter((entry) =>
    isModelCoolingDown(entry.modelId, now),
  ).length;
  resetModelHealth();
  return cooling;
}

interface TopicRow {
  topic?: string;
  kind: string;
  lastUsedAt?: Date;
}

export function recentTopics(rows: TopicRow[], limit = RECENT_TOPICS) {
  const topics = new Map<string, { topic: string; kinds: Set<string>; lastUsedAt: Date | null }>();
  for (const row of rows) {
    if (!row.topic) continue;
    if (!topics.has(row.topic) && topics.size >= limit) break;
    const current = topics.get(row.topic) ?? {
      topic: row.topic,
      kinds: new Set<string>(),
      lastUsedAt: row.lastUsedAt ?? null,
    };
    current.kinds.add(row.kind);
    if (row.lastUsedAt && (!current.lastUsedAt || row.lastUsedAt > current.lastUsedAt)) {
      current.lastUsedAt = row.lastUsedAt;
    }
    topics.set(row.topic, current);
  }
  return [...topics.values()].slice(0, limit).map((entry) => ({
    topic: entry.topic,
    kinds: [...entry.kinds].sort(),
    lastUsedAt: entry.lastUsedAt?.toISOString() ?? null,
  }));
}

async function learningCollection() {
  return (await getDb()).collection<MemoryDoc>(DB_CONFIG.learningCollection);
}

export async function learnedMemorySummary() {
  const memory = await learningCollection();
  const [counts, rows] = await Promise.all([
    memory
      .aggregate<{ _id: string; count: number }>([{ $group: { _id: "$kind", count: { $sum: 1 } } }])
      .toArray(),
    memory
      .find(
        { kind: { $in: [...LEARNED_KINDS] } },
        { projection: { topic: 1, kind: 1, lastUsedAt: 1 } },
      )
      .sort({ lastUsedAt: -1 })
      .limit(RECENT_TOPIC_SCAN)
      .toArray(),
  ]);
  const count = (kind: string) => counts.find((row) => row._id === kind)?.count ?? 0;
  return {
    rewrites: count("rewrite"),
    verdicts: count("verdict"),
    models: count("model"),
    memoryDays: SELF_LEARNING_CONFIG.memoryDays,
    topics: recentTopics(rows),
  };
}

export const forgetTopicSchema = z
  .object({
    topic: z.string().trim().max(2_000).optional(),
    question: z.string().trim().max(2_000).optional(),
  })
  .refine((value) => Boolean(value.topic || value.question), {
    message: "বিষয় বা প্রশ্ন দিন",
  });

export function resolveTopic(input: { topic?: string; question?: string }): string {
  const topic = input.topic?.trim() || topicKey(input.question ?? "");
  if (!topic) {
    throw new AdminError("এই প্রশ্ন থেকে কোনো বিষয় বের করা যায়নি। আরও নির্দিষ্ট শব্দ লিখুন।");
  }
  return topic;
}

export async function forgetTopic(input: { topic?: string; question?: string }) {
  const topic = resolveTopic(input);
  const stored = await (
    await learningCollection()
  ).countDocuments({ topic, kind: { $in: [...LEARNED_KINDS] } });
  await forgetLearnedTopic(topic);
  return { topic, removed: stored };
}

export async function clearLearnedMemory(): Promise<number> {
  const memory = await learningCollection();
  const filter = { kind: { $in: [...LEARNED_KINDS] } };
  const topics = (await memory.distinct("topic", filter)).filter(
    (topic): topic is string => typeof topic === "string" && topic.length > 0,
  );
  const { deletedCount } = await memory.deleteMany(filter);
  for (const topic of topics) {
    forgetRewrites(topic);
    forgetVerdicts(topic);
  }
  return deletedCount;
}

async function queryEmbeddingCollection() {
  return (await getDb()).collection<{ _id: string }>(DB_CONFIG.queryEmbeddingCollection);
}

export async function queryEmbeddingSummary() {
  return { count: await (await queryEmbeddingCollection()).estimatedDocumentCount() };
}

export async function clearQueryEmbeddings(): Promise<number> {
  return (await (await queryEmbeddingCollection()).deleteMany({})).deletedCount;
}

export async function maintenanceOverview(now = Date.now()) {
  const [storage, models, memory, queryEmbeddings] = await Promise.all([
    settled(storageSummary),
    settled(() => modelHealthSnapshot(now)),
    settled(learnedMemorySummary),
    settled(queryEmbeddingSummary),
  ]);
  return { generatedAt: new Date(now).toISOString(), storage, models, memory, queryEmbeddings };
}

export type MaintenanceOverview = Awaited<ReturnType<typeof maintenanceOverview>>;

interface Counter {
  w: number;
  c: number;
}

export interface RateLimitDoc {
  _id: string;
  minute?: Counter;
  hour?: Counter;
  day?: Counter;
}

export interface RateLimitClient {
  id: string;
  client: string;
  shared: boolean;
  minute: number;
  hour: number;
  day: number;
  blocked: boolean;
}

export interface RateLimitScope {
  scope: string;
  limits: { minute: number; hour: number; day: number } | null;
  clients: RateLimitClient[];
}

const RATE_ID = /^([A-Za-z][A-Za-z0-9]{0,39}):([a-f0-9]{24}|global)$/;

export const unblockSchema = z.object({ id: z.string().regex(RATE_ID) });

export function maskClient(client: string): string {
  return client === "global" ? "সবার মোট" : `${client.slice(0, 6)}••••${client.slice(-2)}`;
}

function current(counter: Counter | undefined, window: "minute" | "hour" | "day", now: number) {
  return counter && counter.w === windowIndex(now, window) ? counter.c : 0;
}

export function groupRateLimits(
  docs: RateLimitDoc[],
  now: number,
  perScope = CLIENTS_PER_SCOPE,
): RateLimitScope[] {
  const scopes = new Map<string, RateLimitClient[]>();
  const configured = RATE_LIMIT_CONFIG.scopes as Record<
    string,
    { minute: number; hour: number; day: number }
  >;

  for (const doc of docs) {
    const match = RATE_ID.exec(doc._id);
    if (!match?.[1] || !match[2]) continue;
    const [, scope, client] = match;
    const limits = configured[scope];
    const counts = {
      minute: current(doc.minute, "minute", now),
      hour: current(doc.hour, "hour", now),
      day: current(doc.day, "day", now),
    };
    if (counts.day === 0 && counts.hour === 0 && counts.minute === 0) continue;

    const row: RateLimitClient = {
      id: doc._id,
      client: maskClient(client),
      shared: client === "global",
      ...counts,
      blocked:
        client !== "global" &&
        limits !== undefined &&
        (counts.minute > limits.minute || counts.hour > limits.hour || counts.day > limits.day),
    };
    scopes.set(scope, [...(scopes.get(scope) ?? []), row]);
  }

  return [...scopes.entries()]
    .map(([scope, clients]) => ({
      scope,
      limits: configured[scope] ?? null,
      clients: clients
        .sort((left, right) => right.day - left.day || right.hour - left.hour)
        .slice(0, perScope),
    }))
    .sort(
      (left, right) =>
        right.clients.reduce((sum, row) => sum + row.day, 0) -
        left.clients.reduce((sum, row) => sum + row.day, 0),
    );
}

async function rateLimitCollection() {
  return (await getDb()).collection<RateLimitDoc>(DB_CONFIG.rateLimitCollection);
}

export async function listRateLimits(now = Date.now()) {
  const docs = await (
    await rateLimitCollection()
  )
    .find({ "day.w": windowIndex(now, "day") }, { projection: { minute: 1, hour: 1, day: 1 } })
    .sort({ "day.c": -1 })
    .limit(RATE_LIMIT_SCAN)
    .toArray();
  return { generatedAt: new Date(now).toISOString(), scopes: groupRateLimits(docs, now) };
}

export type RateLimitList = Awaited<ReturnType<typeof listRateLimits>>;

export async function unblockRateLimit(id: string): Promise<void> {
  if (!RATE_ID.test(id)) throw new AdminError("ক্লায়েন্টের পরিচয় সঠিক নয়।");
  const { deletedCount } = await (await rateLimitCollection()).deleteOne({ _id: id });
  if (deletedCount === 0) {
    throw new AdminError("এই ক্লায়েন্টের হিসাব আর নেই। হয়তো আগেই মুছে গেছে।", 404);
  }
}
