import { Binary, ObjectId } from "mongodb";
import {
  ARABIC_TEXT_SOURCES,
  DB_CONFIG,
  HYBRID_CONFIG,
  QURAN_NOTE_SEARCH_CONFIG,
  RETRIEVAL_CONFIG,
  SOURCE_PRIORITY,
} from "@/config/site";
import { getDocumentsCollection } from "@/lib/db/mongoClient";
import {
  contentHash,
  currentEmbeddingModel,
  type IngestionPlan,
  type StoredFingerprint,
} from "@/lib/ingestion/fingerprint";
import {
  HYDRATION_PROJECTION,
  hydrateCitation,
  storedCitation,
  storedMetadata,
  type StoredCitation,
} from "@/lib/db/documentShape";
import { arabicQueryTerms } from "@/lib/retrieval/arabicTerms";
import { fuseRankings } from "@/lib/retrieval/fusion";
import { searchQuranNotes } from "@/lib/retrieval/quranNoteIndex";
import { topicQuery } from "@/lib/retrieval/questionFiller";
import { expandQueryTerms } from "@/lib/retrieval/synonyms";
import type { HadithGrade, RetrievedChunk, SourceType } from "@/types";

interface SearchRow {
  _id: unknown;
  content: string;
  citation: StoredCitation;
  metadata?: Record<string, unknown>;
  score: number;
  grades?: HadithGrade[];
}

export function storedContentHash(content: string): Binary {
  return new Binary(Buffer.from(contentHash(content), "hex"));
}

function hashHex(value: string | Binary): string {
  return typeof value === "string" ? value : Buffer.from(value.buffer).toString("hex");
}

export function toFloat32Vector(embedding: number[]): Binary {
  return Binary.fromFloat32Array(new Float32Array(embedding));
}

function toChunk(
  row: SearchRow,
  sourceType: SourceType,
  retrievedBy: RetrievedChunk["retrievedBy"],
): RetrievedChunk {
  return {
    id: String(row._id),
    sourceType,
    content: row.content,
    citation: hydrateCitation(row.citation, sourceType, row.metadata),
    similarity: row.score,
    retrievedBy,
    ...(row.grades && row.grades.length > 0 ? { grades: row.grades } : {}),
  };
}

export async function similaritySearch(
  queryEmbedding: number[],
  sourceType: SourceType,
  limit: number,
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
          ...HYDRATION_PROJECTION,
          grades: "$metadata.grades",
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();

  return rows.map((row) => toChunk(row, sourceType, "vector"));
}

export function arabicTermsClause(terms: readonly string[]): Record<string, unknown> {
  const words = terms.filter((term) => !term.includes(" "));
  const phrases = terms.filter((term) => term.includes(" "));
  const should = [
    ...(words.length > 0 ? [{ text: { query: words.join(" "), path: "content" } }] : []),
    ...(phrases.length > 0 ? [{ phrase: { query: phrases, path: "content" } }] : []),
  ];
  return { compound: { should, minimumShouldMatch: 1 } };
}

async function runTextSearch(
  query: string | Record<string, unknown>,
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
            must: [typeof query === "string" ? { text: { query, path: "content" } } : query],
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
          ...HYDRATION_PROJECTION,
          grades: "$metadata.grades",
          score: { $meta: "searchScore" },
        },
      },
    ])
    .toArray();

  return rows.map((row) => toChunk(row, sourceType, "text"));
}

async function quranNoteHits(
  query: string,
  limit: number,
  expandSynonyms: boolean,
): Promise<RetrievedChunk[]> {
  const hits = await searchQuranNotes(query, limit, expandSynonyms);
  if (hits.length === 0) return [];

  const collection = await getDocumentsCollection();
  const rows = await collection
    .find(
      {
        sourceType: "quran",
        $or: hits.map((hit) => ({ "metadata.surah": hit.surah, "metadata.ayah": hit.ayah })),
      },
      { projection: { content: 1, citation: 1, ...HYDRATION_PROJECTION } },
    )
    .toArray();

  return hits.flatMap((hit) => {
    const row = rows.find(
      (candidate) =>
        candidate.metadata?.surah === hit.surah && candidate.metadata?.ayah === hit.ayah,
    );
    return row
      ? [
          toChunk(
            {
              _id: row._id,
              content: row.content,
              citation: row.citation,
              metadata: row.metadata,
              score: hit.score,
            },
            "quran",
            "text",
          ),
        ]
      : [];
  });
}

export async function textSearch(
  query: string,
  sourceType: SourceType,
  limit: number = HYBRID_CONFIG.textCandidatesPerSource,
  expandSynonyms = true,
): Promise<RetrievedChunk[]> {
  const extras = expandSynonyms ? expandQueryTerms(query) : [];
  const arabic = ARABIC_TEXT_SOURCES.includes(sourceType) ? arabicQueryTerms(query) : [];

  const topic = topicQuery(query);

  const [plain, expanded, arabicHits, noteHits] = await Promise.all([
    runTextSearch(topic, sourceType, limit),
    extras.length > 0
      ? runTextSearch(`${topic} ${extras.join(" ")}`, sourceType, limit)
      : Promise.resolve<RetrievedChunk[]>([]),
    arabic.length > 0
      ? runTextSearch(arabicTermsClause(arabic), sourceType, limit)
      : Promise.resolve<RetrievedChunk[]>([]),
    sourceType === "quran"
      ? quranNoteHits(query, limit, expandSynonyms)
      : Promise.resolve<RetrievedChunk[]>([]),
  ]);

  const confident = (hits: RetrievedChunk[]) =>
    hits.filter((hit) => hit.similarity >= HYBRID_CONFIG.minTextScore);

  return fuseRankings(
    [confident(plain), confident(expanded), confident(arabicHits), confident(noteHits)],
    HYBRID_CONFIG.fusionK,
    [1, 1, 1, QURAN_NOTE_SEARCH_CONFIG.fusionWeight],
  );
}

const WRITE_BATCH_SIZE = 500;

function needsEmbeddingFilter() {
  return {
    $or: [{ embedding: { $exists: false } }, { embeddingModel: { $ne: currentEmbeddingModel() } }],
  };
}

export async function loadFingerprints(sourceType: SourceType): Promise<StoredFingerprint[]> {
  const collection = await getDocumentsCollection();
  const rows = await collection
    .aggregate<{
      _id: ObjectId;
      citation: StoredCitation;
      contentHash?: string | Binary;
      content?: string;
      embedded: boolean;
      metadata?: Record<string, unknown>;
    }>([
      { $match: { sourceType } },
      {
        $project: {
          citation: 1,
          contentHash: 1,
          metadata: 1,
          content: { $cond: [{ $ifNull: ["$contentHash", false] }, "$$REMOVE", "$content"] },
          embedded: {
            $and: [
              { $ne: [{ $type: "$embedding" }, "missing"] },
              { $eq: ["$embeddingModel", currentEmbeddingModel()] },
            ],
          },
        },
      },
      { $unset: "metadata.grades" },
    ])
    .toArray();

  return rows.map((row) => ({
    id: String(row._id),
    reference: row.citation.reference,
    hash: row.contentHash ? hashHex(row.contentHash) : contentHash(row.content ?? ""),
    embedded: row.embedded,
    citation: row.citation,
    metadata: row.metadata ?? {},
  }));
}

function metadataSet(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).map(([key, value]) => [`metadata.${key}`, value]),
  );
}

export interface PlanResult {
  inserted: number;
  changed: number;
  metadataUpdated: number;
  duplicatesRemoved: number;
  staleRemoved: number;
}

export async function applyIngestionPlan(
  plan: IngestionPlan,
  options: { prune: boolean },
): Promise<PlanResult> {
  const collection = await getDocumentsCollection();

  for (let start = 0; start < plan.inserts.length; start += WRITE_BATCH_SIZE) {
    await collection.insertMany(
      plan.inserts.slice(start, start + WRITE_BATCH_SIZE).map((document) => ({
        sourceType: document.sourceType,
        content: document.content,
        contentHash: storedContentHash(document.content),
        citation: storedCitation(document.citation, document.sourceType, document.metadata),
        metadata: storedMetadata(document.metadata ?? {}, document.sourceType),
      })),
    );
  }

  const updates = [
    ...plan.changed.map(({ id, document }) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: {
          $set: {
            content: document.content,
            contentHash: storedContentHash(document.content),
            citation: storedCitation(document.citation, document.sourceType, document.metadata),
            ...metadataSet(storedMetadata(document.metadata ?? {}, document.sourceType)),
          },
          $unset: { embedding: "", embeddingModel: "" },
        },
      },
    })),
    ...plan.metadataOnly.map(({ id, document }) => ({
      updateOne: {
        filter: { _id: new ObjectId(id) },
        update: {
          $set: {
            citation: storedCitation(document.citation, document.sourceType, document.metadata),
            ...metadataSet(storedMetadata(document.metadata ?? {}, document.sourceType)),
          },
        },
      },
    })),
  ];

  for (let start = 0; start < updates.length; start += WRITE_BATCH_SIZE) {
    await collection.bulkWrite(updates.slice(start, start + WRITE_BATCH_SIZE), { ordered: false });
  }

  const removable = [...plan.duplicates, ...(options.prune ? plan.stale : [])];
  let removed = 0;
  for (let start = 0; start < removable.length; start += WRITE_BATCH_SIZE) {
    const ids = removable.slice(start, start + WRITE_BATCH_SIZE).map((id) => new ObjectId(id));
    removed += (await collection.deleteMany({ _id: { $in: ids } })).deletedCount;
  }

  return {
    inserted: plan.inserts.length,
    changed: plan.changed.length,
    metadataUpdated: plan.metadataOnly.length,
    duplicatesRemoved: Math.min(removed, plan.duplicates.length),
    staleRemoved: options.prune ? Math.max(0, removed - plan.duplicates.length) : 0,
  };
}

export async function listIdsNeedingEmbedding(sourceType: SourceType): Promise<string[]> {
  const collection = await getDocumentsCollection();
  const rows = await collection
    .find({ sourceType, ...needsEmbeddingFilter() }, { projection: { _id: 1 } })
    .toArray();

  return rows.map((row) => String(row._id));
}

export async function attachEmbeddings(
  entries: { id: string; embedding: number[]; content: string }[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const collection = await getDocumentsCollection();
  const result = await collection.bulkWrite(
    entries.map((entry) => {
      const hash = contentHash(entry.content);
      const stored = storedContentHash(entry.content);
      return {
        updateOne: {
          filter: {
            _id: new ObjectId(entry.id),
            $or: [
              { contentHash: stored },
              { contentHash: hash },
              { contentHash: { $exists: false }, content: entry.content },
            ],
          },
          update: {
            $set: {
              embedding: toFloat32Vector(entry.embedding),
              embeddingModel: currentEmbeddingModel(),
              contentHash: stored,
            },
          },
        },
      };
    }),
  );

  return result.modifiedCount;
}

export async function findChunksByReferences(references: string[]): Promise<RetrievedChunk[]> {
  if (references.length === 0) return [];

  const collection = await getDocumentsCollection();
  const rows = await collection
    .find(
      { sourceType: { $in: [...SOURCE_PRIORITY] }, "citation.reference": { $in: references } },
      {
        projection: {
          content: 1,
          citation: 1,
          sourceType: 1,
          "metadata.grades": 1,
          ...HYDRATION_PROJECTION,
        },
      },
    )
    .toArray();

  return references.flatMap((reference) => {
    const row = rows.find((candidate) => candidate.citation.reference === reference);
    if (!row) return [];

    const metadata = row.metadata as Record<string, unknown> | undefined;
    const grades = metadata?.grades as HadithGrade[] | undefined;
    return [
      toChunk(
        { _id: row._id, content: row.content, citation: row.citation, metadata, score: 0, grades },
        row.sourceType,
        "history",
      ),
    ];
  });
}

export async function findUnembedded(ids: string[]): Promise<{ id: string; content: string }[]> {
  if (ids.length === 0) return [];

  const collection = await getDocumentsCollection();
  const rows = await collection
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) }, ...needsEmbeddingFilter() },
      { projection: { content: 1 } },
    )
    .toArray();

  return rows.map((row) => ({ id: String(row._id), content: row.content }));
}

export async function embeddingCoverage(): Promise<{ total: number; embedded: number }> {
  const collection = await getDocumentsCollection();

  const [total, embedded] = await Promise.all([
    collection.countDocuments(),
    collection.countDocuments({ embeddingModel: { $exists: true } }),
  ]);

  return { total, embedded };
}
