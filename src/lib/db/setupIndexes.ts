import { DB_CONFIG, RETRIEVAL_CONFIG } from "@/config/site";
import { getDb, getDocumentsCollection } from "@/lib/db/mongoClient";
import { currentEmbeddingModel } from "@/lib/ingestion/fingerprint";
import { ensureStorageIndexes } from "@/lib/maintenance/indexes";
import { logger } from "@/lib/utils/logger";

const VECTOR_INDEX_DEFINITION = {
  fields: [
    {
      type: "vector",
      path: DB_CONFIG.embeddingPath,
      numDimensions: RETRIEVAL_CONFIG.embeddingDimensions,
      similarity: "cosine",
    },
    {
      type: "filter",
      path: "sourceType",
    },
  ],
};

const TEXT_INDEX_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: {
      content: { type: "string", analyzer: "lucene.bengali" },
      sourceType: { type: "token" },
    },
  },
};

export function definitionMatches(desired: unknown, actual: unknown): boolean {
  if (Array.isArray(desired)) {
    return (
      Array.isArray(actual) &&
      actual.length === desired.length &&
      desired.every((item, index) => definitionMatches(item, actual[index]))
    );
  }

  if (desired && typeof desired === "object") {
    if (!actual || typeof actual !== "object") return false;
    return Object.entries(desired).every(([key, value]) =>
      definitionMatches(value, (actual as Record<string, unknown>)[key]),
    );
  }

  return desired === actual;
}

async function ensureSearchIndex(
  collection: Awaited<ReturnType<typeof getDocumentsCollection>>,
  name: string,
  type: "vectorSearch" | "search",
  definition: Record<string, unknown>,
): Promise<void> {
  const indexes = await collection.listSearchIndexes().toArray();
  const existing = (indexes as { name: string; latestDefinition?: unknown }[]).find(
    (index) => index.name === name,
  );

  if (existing) {
    if (definitionMatches(definition, existing.latestDefinition)) {
      logger.info(`${type} index "${name}" already matches its definition, not rebuilding`);
      return;
    }

    await collection.updateSearchIndex(name, definition);
    logger.info(`Updated ${type} index "${name}", Atlas rebuilds it asynchronously`);
    return;
  }

  await collection.createSearchIndex({ name, type, definition });
  logger.info(`Created ${type} index "${name}" — Atlas builds it asynchronously`);
}

export async function setupIndexes(): Promise<void> {
  const db = await getDb();
  const existing = await db.listCollections({ name: DB_CONFIG.collection }).toArray();

  if (existing.length === 0) {
    await db.createCollection(DB_CONFIG.collection);
    logger.info(`Created collection "${DB_CONFIG.collection}"`);
  }

  const collection = await getDocumentsCollection();

  const labelled = await collection.updateMany(
    { embedding: { $exists: true }, embeddingModel: { $exists: false } },
    { $set: { embeddingModel: currentEmbeddingModel() } },
  );
  if (labelled.modifiedCount > 0) {
    logger.info(
      `Labelled ${labelled.modifiedCount} legacy embeddings as ${currentEmbeddingModel()}`,
    );
  }

  await ensureStorageIndexes(db);

  await ensureSearchIndex(
    collection,
    DB_CONFIG.vectorIndex,
    "vectorSearch",
    VECTOR_INDEX_DEFINITION,
  );
  await ensureSearchIndex(collection, DB_CONFIG.textIndex, "search", TEXT_INDEX_DEFINITION);
}
