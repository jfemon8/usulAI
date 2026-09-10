import { DB_CONFIG, RETRIEVAL_CONFIG } from "@/config/site";
import { getDb, getDocumentsCollection } from "@/lib/db/mongoClient";
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
      content: { type: "string", analyzer: "lucene.standard" },
      sourceType: { type: "token" },
    },
  },
};

async function ensureSearchIndex(
  collection: Awaited<ReturnType<typeof getDocumentsCollection>>,
  name: string,
  type: "vectorSearch" | "search",
  definition: Record<string, unknown>,
): Promise<void> {
  const indexes = await collection.listSearchIndexes().toArray();

  if (indexes.some((index) => index.name === name)) {
    await collection.updateSearchIndex(name, definition);
    logger.info(`Updated ${type} index "${name}"`);
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
  await collection.createIndex({ sourceType: 1 });
  await collection.createIndex({ sourceType: 1, "citation.reference": 1 });
  await collection.createIndex({ embedding: 1 }, { sparse: true });

  await ensureSearchIndex(
    collection,
    DB_CONFIG.vectorIndex,
    "vectorSearch",
    VECTOR_INDEX_DEFINITION,
  );
  await ensureSearchIndex(collection, DB_CONFIG.textIndex, "search", TEXT_INDEX_DEFINITION);
}
