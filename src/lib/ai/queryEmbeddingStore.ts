import { createHash } from "node:crypto";
import { Binary } from "mongodb";
import { DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { currentEmbeddingModel } from "@/lib/ingestion/fingerprint";
import { logger } from "@/lib/utils/logger";

interface StoredQueryEmbedding {
  _id: string;
  embedding: Binary;
  model: string;
  createdAt: Date;
  lastUsedAt: Date;
}

export function queryEmbeddingKey(normalizedQuery: string): string {
  return createHash("sha256")
    .update(`${currentEmbeddingModel()}|query|${normalizedQuery}`, "utf8")
    .digest("hex");
}

async function collection() {
  return (await getDb()).collection<StoredQueryEmbedding>(DB_CONFIG.queryEmbeddingCollection);
}

export async function readStoredQueryEmbedding(key: string): Promise<number[] | null> {
  try {
    const row = await (
      await collection()
    ).findOneAndUpdate(
      { _id: key },
      { $set: { lastUsedAt: new Date() } },
      { projection: { embedding: 1 } },
    );

    return row ? Array.from(row.embedding.toFloat32Array()) : null;
  } catch (error) {
    logger.warn("Stored query embedding lookup failed", { error: String(error).slice(0, 160) });
    return null;
  }
}

export async function storeQueryEmbedding(key: string, embedding: number[]): Promise<void> {
  try {
    const now = new Date();
    await (
      await collection()
    ).updateOne(
      { _id: key },
      {
        $setOnInsert: {
          embedding: Binary.fromFloat32Array(new Float32Array(embedding)),
          model: currentEmbeddingModel(),
          createdAt: now,
        },
        $set: { lastUsedAt: now },
      },
      { upsert: true },
    );
  } catch (error) {
    logger.warn("Storing query embedding failed", { error: String(error).slice(0, 160) });
  }
}
