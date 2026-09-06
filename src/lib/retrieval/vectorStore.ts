import { DB_CONFIG, RETRIEVAL_CONFIG } from "@/config/site";
import { getDocumentsCollection } from "@/lib/db/mongoClient";
import type { RetrievedChunk, SourceCitation, SourceType } from "@/types";

interface VectorSearchRow {
  _id: unknown;
  content: string;
  citation: SourceCitation;
  similarity: number;
}

export async function similaritySearch(
  queryEmbedding: number[],
  sourceType: SourceType,
  limit: number = RETRIEVAL_CONFIG.topKPerSource,
): Promise<RetrievedChunk[]> {
  const collection = await getDocumentsCollection();

  const rows = await collection
    .aggregate<VectorSearchRow>([
      {
        $vectorSearch: {
          index: DB_CONFIG.vectorIndex,
          path: DB_CONFIG.embeddingPath,
          queryVector: queryEmbedding,
          numCandidates: limit * RETRIEVAL_CONFIG.candidateMultiplier,
          limit,
          filter: { sourceType: { $eq: sourceType } },
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          citation: 1,
          similarity: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();

  return rows.map((row) => ({
    id: String(row._id),
    sourceType,
    content: row.content,
    citation: row.citation,
    similarity: row.similarity,
  }));
}

interface UpsertableChunk {
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

export async function upsertChunks(chunks: UpsertableChunk[]): Promise<void> {
  if (chunks.length === 0) return;

  const collection = await getDocumentsCollection();
  const createdAt = new Date();

  await collection.insertMany(
    chunks.map((chunk) => ({
      sourceType: chunk.sourceType,
      content: chunk.content,
      citation: chunk.citation,
      metadata: chunk.metadata ?? {},
      embedding: chunk.embedding,
      createdAt,
    })),
  );
}

export async function deleteSourceChunks(sourceType: SourceType): Promise<number> {
  const collection = await getDocumentsCollection();
  const { deletedCount } = await collection.deleteMany({ sourceType });
  return deletedCount;
}
