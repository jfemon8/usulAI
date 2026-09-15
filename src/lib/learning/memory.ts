import { createHash } from "crypto";
import { DB_CONFIG, SELF_LEARNING_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { logger } from "@/lib/utils/logger";

export type MemoryKind = "rewrite" | "verdict" | "model";

export interface MemoryDoc<T = unknown> {
  _id: string;
  kind: MemoryKind;
  topic?: string;
  value: T;
  updatedAt: Date;
  lastUsedAt: Date;
}

export function memoryId(kind: MemoryKind, key: string): string {
  return `${kind}:${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

async function collection<T>() {
  return (await getDb()).collection<MemoryDoc<T>>(DB_CONFIG.learningCollection);
}

export async function recall<T>(kind: MemoryKind, key: string): Promise<T | null> {
  if (!SELF_LEARNING_CONFIG.enabled) return null;
  try {
    const memory = await collection<T>();
    const row = await memory.findOneAndUpdate(
      { _id: memoryId(kind, key) },
      { $set: { lastUsedAt: new Date() } },
    );
    return row ? row.value : null;
  } catch (error) {
    logger.warn("Learned memory lookup failed", { kind, error: String(error).slice(0, 120) });
    return null;
  }
}

export async function remember<T>(
  kind: MemoryKind,
  key: string,
  value: T,
  topic?: string,
): Promise<void> {
  if (!SELF_LEARNING_CONFIG.enabled) return;
  try {
    const memory = await collection<T>();
    const now = new Date();
    await memory.updateOne(
      { _id: memoryId(kind, key) },
      { $set: { kind, value, updatedAt: now, lastUsedAt: now, ...(topic ? { topic } : {}) } },
      { upsert: true },
    );
  } catch (error) {
    logger.warn("Learned memory write failed", { kind, error: String(error).slice(0, 120) });
  }
}

export async function forgetTopic(topic: string): Promise<number> {
  if (!topic) return 0;
  try {
    const memory = await collection();
    const { deletedCount } = await memory.deleteMany({
      topic,
      kind: { $in: ["rewrite", "verdict"] },
    });
    return deletedCount;
  } catch (error) {
    logger.warn("Learned memory reset failed", { error: String(error).slice(0, 120) });
    return 0;
  }
}

export async function listMemory<T>(kind: MemoryKind): Promise<MemoryDoc<T>[]> {
  try {
    return (await collection<T>()).find({ kind }).toArray();
  } catch {
    return [];
  }
}

export async function bumpCounters(
  kind: MemoryKind,
  key: string,
  counters: Record<string, number>,
): Promise<void> {
  if (!SELF_LEARNING_CONFIG.enabled) return;
  try {
    const memory = await collection<Record<string, number>>();
    const now = new Date();
    await memory.updateOne(
      { _id: memoryId(kind, key) },
      {
        $inc: Object.fromEntries(
          Object.entries(counters).map(([name, amount]) => [`value.${name}`, amount]),
        ),
        $set: { kind, updatedAt: now, lastUsedAt: now },
        $setOnInsert: { topic: key },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.warn("Learned counter write failed", { kind, error: String(error).slice(0, 120) });
  }
}
