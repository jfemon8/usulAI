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

export async function setupIndexes(): Promise<void> {
  const db = await getDb();
  const existing = await db.listCollections({ name: DB_CONFIG.collection }).toArray();

  if (existing.length === 0) {
    await db.createCollection(DB_CONFIG.collection);
    logger.info(`Created collection "${DB_CONFIG.collection}"`);
  }

  const collection = await getDocumentsCollection();
  await collection.createIndex({ sourceType: 1 });

  const searchIndexes = await collection.listSearchIndexes().toArray();
  const hasVectorIndex = searchIndexes.some((index) => index.name === DB_CONFIG.vectorIndex);

  if (hasVectorIndex) {
    await collection.updateSearchIndex(DB_CONFIG.vectorIndex, VECTOR_INDEX_DEFINITION);
    logger.info(`Updated vector index "${DB_CONFIG.vectorIndex}"`);
    return;
  }

  await collection.createSearchIndex({
    name: DB_CONFIG.vectorIndex,
    type: "vectorSearch",
    definition: VECTOR_INDEX_DEFINITION,
  });
  logger.info(`Created vector index "${DB_CONFIG.vectorIndex}" — Atlas builds it asynchronously`);
}
