import type { Collection, Db, Document, IndexSpecification } from "mongodb";
import { DB_CONFIG, RETENTION_CONFIG } from "@/config/site";
import { logger } from "@/lib/utils/logger";

const REDUNDANT_DOCUMENT_INDEXES = [
  "embedding_1",
  "sourceType_1",
  "sourceType_1_metadata.collection_1_metadata.hadithNumber_1",
  "sourceType_1_metadata.surah_1_metadata.ayah_1",
];

const DAY_SECONDS = 86_400;

async function dropIfPresent(collection: Collection<Document>, names: string[]): Promise<string[]> {
  const existing = new Set((await collection.indexes()).map((index) => index.name));
  const dropped: string[] = [];

  for (const name of names) {
    if (!existing.has(name)) continue;
    await collection.dropIndex(name);
    dropped.push(name);
  }

  return dropped;
}

async function ensureTtl(
  collection: Collection<Document>,
  field: string,
  seconds: number,
): Promise<void> {
  const key: IndexSpecification = { [field]: 1 };
  const current = (await collection.indexes()).find(
    (index) => Object.keys(index.key).length === 1 && index.key[field] === 1,
  );

  if (current?.expireAfterSeconds === seconds) return;

  if (current?.name) {
    try {
      await collection.db.command({
        collMod: collection.collectionName,
        index: { keyPattern: key, expireAfterSeconds: seconds },
      });
      logger.info(
        `TTL on ${collection.collectionName}.${field} set to ${seconds / DAY_SECONDS} days`,
      );
      return;
    } catch {
      await collection.dropIndex(current.name);
    }
  }

  await collection.createIndex(key, { expireAfterSeconds: seconds });
  logger.info(
    `TTL on ${collection.collectionName}.${field} created at ${seconds / DAY_SECONDS} days`,
  );
}

export async function ensureStorageIndexes(db: Db): Promise<{ dropped: string[] }> {
  const documents = db.collection(DB_CONFIG.collection);

  await documents.createIndex({ sourceType: 1, "citation.reference": 1 });
  await documents.createIndex(
    { "metadata.collection": 1, "metadata.hadithNumber": 1 },
    { partialFilterExpression: { sourceType: "hadith" }, name: "hadith_collection_number" },
  );
  await documents.createIndex(
    { embeddingModel: 1 },
    { partialFilterExpression: { embeddingModel: { $exists: true } }, name: "embedded_documents" },
  );

  const dropped = await dropIfPresent(documents, REDUNDANT_DOCUMENT_INDEXES);
  if (dropped.length > 0) logger.info(`Dropped redundant indexes: ${dropped.join(", ")}`);

  await ensureTtl(
    db.collection(DB_CONFIG.queryLogCollection),
    "createdAt",
    RETENTION_CONFIG.queryLogDays * DAY_SECONDS,
  );
  await ensureTtl(
    db.collection(DB_CONFIG.queryEmbeddingCollection),
    "lastUsedAt",
    RETENTION_CONFIG.queryEmbeddingDays * DAY_SECONDS,
  );
  await db.collection(DB_CONFIG.queryInsightsCollection).createIndex({ lastAskedAt: 1 });

  return { dropped };
}
