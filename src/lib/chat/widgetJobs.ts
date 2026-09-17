import { DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";

const JOB_LIFETIME_MS = 20 * 60_000;
const MAX_STREAM_BYTES = 4_000_000;
const MAX_CHUNKS_PER_READ = 200;

interface WidgetJob {
  _id: string;
  status: "running" | "complete" | "error";
  chunks: string[];
  chunkCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface WidgetJobSnapshot {
  status: WidgetJob["status"];
  chunks: string[];
  chunkCount: number;
  error?: string;
}

async function jobs() {
  return (await getDb()).collection<WidgetJob>(DB_CONFIG.widgetJobCollection);
}

let indexPromise: Promise<string> | undefined;

export async function createWidgetJob(id: string): Promise<void> {
  const collection = await jobs();
  indexPromise ??= collection
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch((error: unknown) => {
      indexPromise = undefined;
      throw error;
    });
  await indexPromise;
  const now = new Date();
  await collection.insertOne({
    _id: id,
    status: "running",
    chunks: [],
    chunkCount: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + JOB_LIFETIME_MS),
  });
}

export async function appendWidgetJobChunks(id: string, chunks: string[]): Promise<void> {
  if (chunks.length === 0) return;
  await (
    await jobs()
  ).updateOne(
    { _id: id, status: "running" },
    {
      $push: { chunks: { $each: chunks } },
      $inc: { chunkCount: chunks.length },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function finishWidgetJob(id: string, error?: string): Promise<void> {
  await (
    await jobs()
  ).updateOne(
    { _id: id, status: "running" },
    {
      $set: {
        status: error ? "error" : "complete",
        ...(error ? { error: error.slice(0, 300) } : {}),
        updatedAt: new Date(),
      },
    },
  );
}

export async function readWidgetJob(id: string, from: number): Promise<WidgetJobSnapshot | null> {
  const job = await (
    await jobs()
  ).findOne(
    { _id: id },
    {
      projection: {
        status: 1,
        error: 1,
        chunkCount: 1,
        updatedAt: 1,
        chunks: { $slice: [from, MAX_CHUNKS_PER_READ] },
      },
    },
  );
  if (!job) return null;
  const stale = job.status === "running" && Date.now() - job.updatedAt.getTime() > 6 * 60_000;
  return {
    status: stale ? "error" : job.status,
    chunks: job.chunks ?? [],
    chunkCount: job.chunkCount,
    ...(stale ? { error: "Answer generation was interrupted. Please try again." } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

export async function storeWidgetJobStream(id: string, response: Response): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error((await response.text()).slice(0, 300) || "Answer generation failed.");
  }

  const reader = response.body.getReader();
  let batch: string[] = [];
  let bytes = 0;
  let lastFlush = Date.now();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_STREAM_BYTES) throw new Error("Answer stream exceeded its size limit.");
      batch.push(Buffer.from(value).toString("base64"));
      if (batch.length >= 16 || Date.now() - lastFlush >= 250) {
        await appendWidgetJobChunks(id, batch);
        batch = [];
        lastFlush = Date.now();
      }
    }
    await appendWidgetJobChunks(id, batch);
    await finishWidgetJob(id);
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
