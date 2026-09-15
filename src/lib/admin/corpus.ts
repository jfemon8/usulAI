import { BSON, Binary, ObjectId, type Collection } from "mongodb";
import { z } from "zod";
import { DB_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { AdminError } from "@/lib/admin/http";
import {
  hydrateCitation,
  hydrateMetadata,
  hydrateReference,
  referenceFilters,
  storedCitation,
  storedMetadata,
  storedReference,
  type StoredCitation,
} from "@/lib/db/documentShape";
import { getDocumentsCollection, type DocumentRecord } from "@/lib/db/mongoClient";
import { stripDirectionalMarkCharacters } from "@/lib/ingestion/translations";
import { storedContentHash } from "@/lib/retrieval/vectorStore";
import type {
  CitationFieldInput,
  CorpusDocumentView,
  CorpusEditPayload,
  CorpusListResponse,
  CorpusRow,
  CorpusStatsResponse,
} from "@/components/admin/corpus/types";
import type { SourceCitation, SourceType } from "@/types";

type Metadata = Record<string, unknown>;

export const CORPUS_LIMITS = {
  previewChars: 160,
  searchResults: 50,
  maxQueryChars: 200,
  maxReferenceChars: 500,
  maxContentChars: 400_000,
  maxMetadataChars: 200_000,
  maxCitationFields: 20,
  maxCitationValueChars: 2_000,
  maxMetadataDepth: 20,
  uniquenessCandidates: 200,
} as const;

export const corpusEditSchema = z.object({
  sourceType: z.enum(SOURCE_PRIORITY),
  reference: z.string().max(CORPUS_LIMITS.maxReferenceChars),
  content: z.string().max(CORPUS_LIMITS.maxContentChars),
  citation: z
    .array(
      z.object({
        key: z.string().max(40),
        value: z.string().max(CORPUS_LIMITS.maxCitationValueChars),
      }),
    )
    .max(CORPUS_LIMITS.maxCitationFields),
  metadata: z.string().max(CORPUS_LIMITS.maxMetadataChars),
});

const ADMIN_KEYS = ["adminEdited", "adminEditedAt"] as const;
const RESERVED_CITATION_KEYS = new Set(["reference", "sourceType"]);
const NUMERIC_CITATION_KEYS = new Set(["page", "pageCount"]);
const CITATION_MEDIA = new Set(["web", "image", "pdf"]);
const CITATION_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export interface StoredCorpusDocument {
  sourceType: SourceType;
  reference: string;
  content: string;
  contentHash: Binary;
  citation: StoredCitation;
  metadata: Metadata;
}

export function isObjectIdString(value: string): boolean {
  return OBJECT_ID.test(value.trim());
}

export function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && (SOURCE_PRIORITY as readonly string[]).includes(value);
}

export function cleanCorpusContent(content: string): string {
  return stripDirectionalMarkCharacters(content.replace(/\r\n?/g, "\n")).trim();
}

export function contentPreview(text: string, limit: number = CORPUS_LIMITS.previewChars): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const characters = [...flat];
  return characters.length > limit ? `${characters.slice(0, limit).join("").trimEnd()}…` : flat;
}

export function hashHex(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value instanceof Binary) return Buffer.from(value.buffer).toString("hex");
  return null;
}

export function citationFieldsFor(citation: SourceCitation): CitationFieldInput[] {
  return Object.entries(citation).flatMap(([key, value]) =>
    RESERVED_CITATION_KEYS.has(key) ||
    (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
      ? []
      : [{ key, value: String(value) }],
  );
}

export function parseCitationFields(rows: readonly CitationFieldInput[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key && !value) continue;

    if (!CITATION_KEY.test(key) || RESERVED_CITATION_KEYS.has(key)) {
      throw new AdminError(`সূত্রের ঘরের নাম "${key}" গ্রহণযোগ্য নয়।`);
    }
    if (key in fields) throw new AdminError(`সূত্রের ঘর "${key}" একাধিকবার দেওয়া হয়েছে।`);
    if (!value) continue;

    if (NUMERIC_CITATION_KEYS.has(key)) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1) {
        throw new AdminError(`"${key}" অবশ্যই একটি ধনাত্মক পূর্ণসংখ্যা হতে হবে।`);
      }
      fields[key] = number;
    } else if (key === "url") {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new AdminError("সূত্রের url সঠিক নয়।");
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new AdminError("সূত্রের url অবশ্যই http বা https হতে হবে।");
      }
      fields[key] = value;
    } else if (key === "media") {
      if (!CITATION_MEDIA.has(value)) {
        throw new AdminError("media শুধু web, image বা pdf হতে পারে।");
      }
      fields[key] = value;
    } else {
      fields[key] = value;
    }
  }

  return fields;
}

function isPlainObject(value: unknown): value is Metadata {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertStorableKeys(value: unknown, depth: number): void {
  if (depth > CORPUS_LIMITS.maxMetadataDepth) {
    throw new AdminError("মেটাডেটা অনেক বেশি গভীরভাবে নেস্টেড।");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertStorableKeys(item, depth + 1);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".") || key.length === 0) {
      throw new AdminError(`মেটাডেটার ঘরের নাম "${key}" সংরক্ষণযোগ্য নয়।`);
    }
    assertStorableKeys(item, depth + 1);
  }
}

export function parseMetadataJson(text: string): Metadata {
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = BSON.EJSON.parse(text, { relaxed: true });
  } catch (error) {
    throw new AdminError(
      `মেটাডেটা সঠিক Extended JSON নয়: ${error instanceof Error ? error.message : "অজানা সমস্যা"}`,
    );
  }
  if (!isPlainObject(parsed)) {
    throw new AdminError("মেটাডেটা অবশ্যই একটি JSON অবজেক্ট ({ ... }) হতে হবে।");
  }
  assertStorableKeys(parsed, 0);
  return parsed;
}

export function serializeMetadata(metadata: Metadata): string {
  const visible = { ...metadata };
  for (const key of ADMIN_KEYS) delete visible[key];
  return BSON.EJSON.stringify(visible, undefined, 2, { relaxed: true });
}

export function buildStoredDocument(
  input: CorpusEditPayload,
  options: { now: Date; restricted?: boolean },
): StoredCorpusDocument {
  const sourceType = input.sourceType;
  if (!isSourceType(sourceType)) throw new AdminError("উৎসের ধরন সঠিক নয়।");

  const reference = stripDirectionalMarkCharacters(input.reference).trim();
  if (!reference) throw new AdminError("রেফারেন্স খালি রাখা যাবে না।");

  const content = cleanCorpusContent(input.content);
  if (!content) throw new AdminError("দলিলের লেখা খালি রাখা যাবে না।");

  const metadata: Metadata = { ...parseMetadataJson(input.metadata) };
  for (const key of ADMIN_KEYS) delete metadata[key];
  if (options.restricted !== undefined) {
    if (options.restricted) metadata.restricted = true;
    else delete metadata.restricted;
  }
  metadata.adminEdited = true;
  metadata.adminEditedAt = options.now;

  const citation = {
    ...parseCitationFields(input.citation),
    reference,
    sourceType,
  } as SourceCitation;

  return {
    sourceType,
    reference,
    content,
    contentHash: storedContentHash(content),
    citation: storedCitation(citation, sourceType, metadata),
    metadata: storedMetadata(metadata, sourceType, reference),
  };
}

export function buildCorpusUpdate(
  existing: { content: string; contentHash?: unknown },
  stored: StoredCorpusDocument,
): {
  contentChanged: boolean;
  update: { $set: Record<string, unknown>; $unset?: Record<string, ""> };
} {
  const contentChanged = existing.content !== stored.content;
  const $set: Record<string, unknown> = {
    sourceType: stored.sourceType,
    citation: stored.citation,
    metadata: stored.metadata,
    ...(contentChanged || !existing.contentHash
      ? { content: stored.content, contentHash: stored.contentHash }
      : {}),
  };

  return {
    contentChanged,
    update: contentChanged ? { $set, $unset: { embedding: "", embeddingModel: "" } } : { $set },
  };
}

export function referenceCandidates(reference: string, metadata: Metadata): string[] {
  return [...new Set([reference, storedReference(reference, metadata)])];
}

function parseObjectId(id: string): ObjectId {
  if (!isObjectIdString(id)) throw new AdminError("দলিলটি পাওয়া যায়নি।", 404);
  return new ObjectId(id.trim());
}

interface RowRecord {
  _id: ObjectId;
  sourceType: SourceType;
  citation: StoredCitation;
  metadata?: Metadata;
  preview?: string;
  embedded: boolean;
  score?: number;
}

const ROW_PROJECTION = {
  sourceType: 1,
  "citation.reference": 1,
  "metadata.fileName": 1,
  "metadata.restricted": 1,
  "metadata.adminEdited": 1,
  preview: { $substrCP: ["$content", 0, CORPUS_LIMITS.previewChars * 2] },
  embedded: { $ne: [{ $type: "$embedding" }, "missing"] },
} as const;

function toRow(record: RowRecord): CorpusRow {
  const metadata = record.metadata ?? {};
  return {
    id: String(record._id),
    sourceType: record.sourceType,
    reference: hydrateReference(record.citation.reference, metadata),
    preview: contentPreview(record.preview ?? ""),
    embedded: record.embedded,
    adminEdited: metadata.adminEdited === true,
    restricted: metadata.restricted === true,
    ...(typeof record.score === "number" ? { score: record.score } : {}),
  };
}

function sourceFilter(source: SourceType | undefined) {
  return source ? { sourceType: source } : { sourceType: { $in: [...SOURCE_PRIORITY] } };
}

async function rowsFor(
  collection: Collection<DocumentRecord>,
  match: Record<string, unknown>,
  limit: number,
  sortById: boolean,
): Promise<RowRecord[]> {
  return collection
    .aggregate<RowRecord>([
      { $match: match },
      ...(sortById ? [{ $sort: { _id: -1 as const } }] : []),
      { $limit: limit },
      { $project: ROW_PROJECTION },
    ])
    .toArray();
}

export async function listCorpus(options: {
  source?: SourceType;
  query?: string;
  cursor?: string;
  pageSize: number;
}): Promise<CorpusListResponse> {
  const collection = await getDocumentsCollection();
  const query = (options.query ?? "").trim().slice(0, CORPUS_LIMITS.maxQueryChars);

  if (!query) {
    if (options.cursor !== undefined && !isObjectIdString(options.cursor)) {
      throw new AdminError("পাতার কার্সর সঠিক নয়।");
    }
    const rows = await rowsFor(
      collection,
      {
        ...(options.source ? { sourceType: options.source } : {}),
        ...(options.cursor ? { _id: { $lt: new ObjectId(options.cursor) } } : {}),
      },
      options.pageSize + 1,
      true,
    );
    const page = rows.slice(0, options.pageSize);
    const last = page.at(-1);
    return {
      mode: "list",
      items: page.map(toRow),
      nextCursor: rows.length > options.pageSize && last ? String(last._id) : null,
      limited: false,
    };
  }

  if (isObjectIdString(query)) {
    const rows = await rowsFor(collection, { _id: new ObjectId(query) }, 1, false);
    return { mode: "id", items: rows.map(toRow), nextCursor: null, limited: false };
  }

  const exact = (
    await rowsFor(
      collection,
      { ...sourceFilter(options.source), $or: referenceFilters([query]) },
      CORPUS_LIMITS.uniquenessCandidates,
      false,
    )
  )
    .map(toRow)
    .filter((row) => row.reference === query);

  if (exact.length > 0) {
    return { mode: "reference", items: exact, nextCursor: null, limited: false };
  }

  const rows = await collection
    .aggregate<RowRecord>([
      {
        $search: {
          index: DB_CONFIG.textIndex,
          compound: {
            must: [{ text: { query, path: "content" } }],
            ...(options.source
              ? { filter: [{ equals: { path: "sourceType", value: options.source } }] }
              : {}),
          },
        },
      },
      { $limit: CORPUS_LIMITS.searchResults },
      { $project: { ...ROW_PROJECTION, score: { $meta: "searchScore" } } },
    ])
    .toArray();

  return {
    mode: "search",
    items: rows.map(toRow),
    nextCursor: null,
    limited: rows.length >= CORPUS_LIMITS.searchResults,
  };
}

export async function corpusStats(): Promise<CorpusStatsResponse> {
  const collection = await getDocumentsCollection();
  const [totals, embedded] = await Promise.all([
    Promise.all(SOURCE_PRIORITY.map((sourceType) => collection.countDocuments({ sourceType }))),
    collection
      .aggregate<{ _id: string; count: number }>([
        { $match: { embeddingModel: { $exists: true } } },
        { $group: { _id: "$sourceType", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const sources = SOURCE_PRIORITY.map((sourceType, index) => ({
    sourceType,
    total: totals[index] ?? 0,
    embedded: embedded.find((entry) => entry._id === sourceType)?.count ?? 0,
  }));

  return {
    sources,
    total: sources.reduce((sum, entry) => sum + entry.total, 0),
    embedded: sources.reduce((sum, entry) => sum + entry.embedded, 0),
  };
}

type FullRecord = DocumentRecord & { _id: ObjectId; embedded: boolean };

async function loadRecord(
  collection: Collection<DocumentRecord>,
  id: ObjectId,
): Promise<FullRecord | null> {
  const [record] = await collection
    .aggregate<FullRecord>([
      { $match: { _id: id } },
      { $addFields: { embedded: { $ne: [{ $type: "$embedding" }, "missing"] } } },
      { $unset: "embedding" },
    ])
    .toArray();
  return record ?? null;
}

function toView(record: FullRecord): CorpusDocumentView {
  const metadata = record.metadata ?? {};
  const citation = hydrateCitation(record.citation, record.sourceType, metadata);
  const editedAt = metadata.adminEditedAt;

  return {
    id: String(record._id),
    sourceType: record.sourceType,
    reference: citation.reference,
    content: record.content,
    citation: citationFieldsFor(citation),
    metadata: serializeMetadata(hydrateMetadata(metadata, citation.reference)),
    embedded: record.embedded,
    embeddingModel: typeof record.embeddingModel === "string" ? record.embeddingModel : null,
    contentHash: hashHex(record.contentHash),
    restricted: metadata.restricted === true,
    adminEdited: metadata.adminEdited === true,
    adminEditedAt: editedAt instanceof Date ? editedAt.toISOString() : null,
  };
}

export async function getCorpusDocument(id: string): Promise<CorpusDocumentView> {
  const collection = await getDocumentsCollection();
  const record = await loadRecord(collection, parseObjectId(id));
  if (!record) throw new AdminError("দলিলটি পাওয়া যায়নি।", 404);
  return toView(record);
}

async function assertReferenceFree(
  collection: Collection<DocumentRecord>,
  stored: StoredCorpusDocument,
  excludeId?: ObjectId,
): Promise<void> {
  const candidates = await collection
    .find(
      {
        sourceType: stored.sourceType,
        $or: referenceFilters(referenceCandidates(stored.reference, stored.metadata)),
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      } as never,
      {
        projection: {
          "citation.reference": 1,
          "metadata.fileName": 1,
          "metadata.restricted": 1,
        },
      },
    )
    .limit(CORPUS_LIMITS.uniquenessCandidates)
    .toArray();

  const taken = candidates.some(
    (candidate) =>
      hydrateReference(candidate.citation.reference, candidate.metadata ?? {}) === stored.reference,
  );
  if (taken) {
    throw new AdminError("এই উৎসে একই রেফারেন্সের আরেকটি দলিল আগে থেকেই আছে।", 409);
  }
}

export async function createCorpusDocument(
  input: CorpusEditPayload,
): Promise<{ view: CorpusDocumentView; stored: StoredCorpusDocument }> {
  const collection = await getDocumentsCollection();
  const stored = buildStoredDocument(input, { now: new Date() });
  await assertReferenceFree(collection, stored);

  const { insertedId } = await collection.insertOne({
    sourceType: stored.sourceType,
    content: stored.content,
    contentHash: stored.contentHash,
    citation: stored.citation,
    metadata: stored.metadata,
  });

  const record = await loadRecord(collection, insertedId);
  if (!record) throw new AdminError("দলিলটি সংরক্ষণের পর পাওয়া যায়নি।", 500);
  return { view: toView(record), stored };
}

export async function updateCorpusDocument(
  id: string,
  input: CorpusEditPayload,
): Promise<{
  view: CorpusDocumentView;
  stored: StoredCorpusDocument;
  previous: { sourceType: SourceType; reference: string };
  contentChanged: boolean;
}> {
  const collection = await getDocumentsCollection();
  const objectId = parseObjectId(id);
  const existing = await collection.findOne(
    { _id: objectId },
    { projection: { content: 1, contentHash: 1, sourceType: 1, citation: 1, metadata: 1 } },
  );
  if (!existing) throw new AdminError("দলিলটি পাওয়া যায়নি।", 404);

  const existingMetadata = existing.metadata ?? {};
  const stored = buildStoredDocument(input, {
    now: new Date(),
    restricted: existingMetadata.restricted === true,
  });
  await assertReferenceFree(collection, stored, objectId);

  const { update, contentChanged } = buildCorpusUpdate(existing, stored);
  const result = await collection.updateOne({ _id: objectId }, update as never);
  if (result.matchedCount === 0) throw new AdminError("দলিলটি পাওয়া যায়নি।", 404);

  const record = await loadRecord(collection, objectId);
  if (!record) throw new AdminError("দলিলটি পাওয়া যায়নি।", 404);

  return {
    view: toView(record),
    stored,
    previous: {
      sourceType: existing.sourceType,
      reference: hydrateReference(existing.citation.reference, existingMetadata),
    },
    contentChanged,
  };
}

export async function deleteCorpusDocument(
  id: string,
): Promise<{ sourceType: SourceType; reference: string }> {
  const collection = await getDocumentsCollection();
  const objectId = parseObjectId(id);
  const existing = await collection.findOneAndDelete(
    { _id: objectId },
    { projection: { sourceType: 1, citation: 1, metadata: 1 } },
  );
  if (!existing) throw new AdminError("দলিলটি পাওয়া যায়নি।", 404);

  return {
    sourceType: existing.sourceType,
    reference: hydrateReference(existing.citation.reference, existing.metadata ?? {}),
  };
}
