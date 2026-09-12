import { Binary, ObjectId } from "mongodb";
import { DB_CONFIG, HYBRID_CONFIG, RETRIEVAL_CONFIG } from "@/config/site";
import { getDocumentsCollection } from "@/lib/db/mongoClient";
import { expandQueryTerms } from "@/lib/retrieval/synonyms";
import type { RetrievedChunk, SourceCitation, SourceType } from "@/types";

interface SearchRow {
  _id: unknown;
  content: string;
  citation: SourceCitation;
  score: number;
}

export function toFloat32Vector(embedding: number[]): Binary {
  return Binary.fromFloat32Array(new Float32Array(embedding));
}

function toChunk(row: SearchRow, sourceType: SourceType, retrievedBy: "vector" | "text") {
  return {
    id: String(row._id),
    sourceType,
    content: row.content,
    citation: row.citation,
    similarity: row.score,
    retrievedBy,
  };
}

export async function similaritySearch(
  queryEmbedding: number[],
  sourceType: SourceType,
  limit: number = RETRIEVAL_CONFIG.topKPerSource,
): Promise<RetrievedChunk[]> {
  const collection = await getDocumentsCollection();

  const rows = await collection
    .aggregate<SearchRow>([
      {
        $vectorSearch: {
          index: DB_CONFIG.vectorIndex,
          path: DB_CONFIG.embeddingPath,
          queryVector: toFloat32Vector(queryEmbedding),
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
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();

  return rows.map((row) => toChunk(row, sourceType, "vector"));
}

async function runTextSearch(
  query: string,
  sourceType: SourceType,
  limit: number,
): Promise<RetrievedChunk[]> {
  const collection = await getDocumentsCollection();

  const rows = await collection
    .aggregate<SearchRow>([
      {
        $search: {
          index: DB_CONFIG.textIndex,
          compound: {
            must: [{ text: { query, path: "content" } }],
            filter: [{ equals: { path: "sourceType", value: sourceType } }],
          },
        },
      },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          content: 1,
          citation: 1,
          score: { $meta: "searchScore" },
        },
      },
    ])
    .toArray();

  return rows.map((row) => toChunk(row, sourceType, "text"));
}

export async function textSearch(
  query: string,
  sourceType: SourceType,
  limit: number = HYBRID_CONFIG.textCandidatesPerSource,
  expandSynonyms = true,
): Promise<RetrievedChunk[]> {
  const extras = expandSynonyms ? expandQueryTerms(query) : [];

  const [plain, expanded] = await Promise.all([
    runTextSearch(query, sourceType, limit),
    extras.length > 0
      ? runTextSearch(extras.join(" "), sourceType, limit)
      : Promise.resolve<RetrievedChunk[]>([]),
  ]);

  const seen = new Set(plain.map((hit) => hit.id));

  return [...plain, ...expanded.filter((hit) => !seen.has(hit.id))];
}

interface UpsertableChunk {
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  metadata?: Record<string, unknown>;
  embedding?: number[];
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
      ...(chunk.embedding ? { embedding: toFloat32Vector(chunk.embedding) } : {}),
      createdAt,
    })),
  );
}

export async function attachEmbeddings(
  entries: { id: string; embedding: number[] }[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const collection = await getDocumentsCollection();
  const result = await collection.bulkWrite(
    entries.map((entry) => ({
      updateOne: {
        filter: { _id: new ObjectId(entry.id) },
        update: {
          $set: { embedding: toFloat32Vector(entry.embedding), embeddedAt: new Date() },
        },
      },
    })),
  );

  return result.modifiedCount;
}

export async function findUnembedded(ids: string[]): Promise<{ id: string; content: string }[]> {
  if (ids.length === 0) return [];

  const collection = await getDocumentsCollection();
  const rows = await collection
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) }, embedding: { $exists: false } },
      { projection: { content: 1 } },
    )
    .toArray();

  return rows.map((row) => ({ id: String(row._id), content: row.content }));
}

export async function embeddingCoverage(): Promise<{ total: number; embedded: number }> {
  const collection = await getDocumentsCollection();

  const [total, embedded] = await Promise.all([
    collection.countDocuments(),
    collection.countDocuments({ embedding: { $exists: true } }),
  ]);

  return { total, embedded };
}

export async function existingReferences(sourceType: SourceType): Promise<Set<string>> {
  const collection = await getDocumentsCollection();
  const references = await collection.distinct("citation.reference", { sourceType });
  return new Set(references as unknown as string[]);
}

export async function deleteSourceChunks(sourceType: SourceType): Promise<number> {
  const collection = await getDocumentsCollection();
  const { deletedCount } = await collection.deleteMany({ sourceType });
  return deletedCount;
}
