import { Binary, type AnyBulkWriteOperation, type Document } from "mongodb";
import { STORAGE_CONFIG } from "@/config/site";
import {
  bookFileNames,
  decodeGrades,
  encodeGrades,
  hydrateReference,
  storedMetadata,
  storedReference,
} from "@/lib/db/documentShape";
import { getDb, getDocumentsCollection } from "@/lib/db/mongoClient";
import {
  DIRECTIONAL_MARK_PATTERN,
  stripDirectionalMarkCharacters,
} from "@/lib/ingestion/translations";
import { storedContentHash } from "@/lib/retrieval/vectorStore";
import { ensureStorageIndexes } from "@/lib/maintenance/indexes";
import { recordProvenance } from "@/lib/maintenance/provenance";
import { describeUsage, storageUsage, type StorageUsage } from "@/lib/maintenance/storage";
import { saveSurahNotes, type SurahNotes } from "@/lib/retrieval/quranNoteStore";
import { logger } from "@/lib/utils/logger";

const UNUSED_DOCUMENT_FIELDS = [
  "metadata.provider",
  "metadata.hasBangla",
  "metadata.hasEnglish",
  "metadata.grade",
  "createdAt",
  "embeddedAt",
];

const BATCH_SIZE = 500;
const REFERENCE_INDEX_NAME = "source_reference_hashed";

export interface OptimizeReport {
  before: StorageUsage;
  after: StorageUsage;
  provenanceRecorded: number;
  notesMoved: number;
  arraysConverted: number;
  fieldsCleared: number;
  derivedFieldsRemoved: Record<string, number>;
  hashesPacked: number;
  nullUrlsRemoved: number;
  referencesCompacted: number;
  chaptersRemoved: number;
  gradesCompacted: number;
  directionalMarksStripped: number;
  indexesDropped: string[];
}

async function migrateProvenance(): Promise<number> {
  const documents = await getDocumentsCollection();
  const rows = await documents
    .aggregate<{ _id: { sourceType: string; provider: string }; count: number }>([
      { $match: { "metadata.provider": { $exists: true } } },
      {
        $group: {
          _id: { sourceType: "$sourceType", provider: "$metadata.provider" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  for (const row of rows) {
    await recordProvenance(
      row._id.sourceType,
      { [row._id.provider]: row.count },
      { replace: false },
    );
  }

  return rows.length;
}

async function moveQuranNotes(): Promise<number> {
  const documents = await getDocumentsCollection();
  const surahs = new Map<number, SurahNotes>();

  for await (const doc of documents.find(
    { sourceType: "quran", "metadata.quranenc": { $exists: true } },
    { projection: { "metadata.surah": 1, "metadata.ayah": 1, "metadata.quranenc": 1 } },
  )) {
    const meta = doc.metadata as {
      surah: number;
      ayah: number;
      quranenc: { translation: string; footnotes?: string };
    };
    const notes = surahs.get(meta.surah) ?? {};
    notes[meta.ayah] = {
      translation: meta.quranenc.translation,
      footnotes: meta.quranenc.footnotes ?? "",
    };
    surahs.set(meta.surah, notes);
  }

  for (const [surah, notes] of surahs) await saveSurahNotes(surah, notes);

  if (surahs.size > 0) {
    await documents.updateMany(
      { sourceType: "quran", "metadata.quranenc": { $exists: true } },
      { $unset: { "metadata.quranenc": "" } },
    );
  }

  return surahs.size;
}

async function convertArrayEmbeddings(): Promise<number> {
  const documents = await getDocumentsCollection();
  let converted = 0;

  for (;;) {
    const batch = await documents
      .find({ embedding: { $type: "array" } }, { projection: { embedding: 1 } })
      .limit(BATCH_SIZE)
      .toArray();
    if (batch.length === 0) break;

    const result = await documents.bulkWrite(
      batch.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              embedding: Binary.fromFloat32Array(
                new Float32Array(doc.embedding as unknown as number[]),
              ),
            },
          },
        },
      })),
    );
    converted += result.modifiedCount;
  }

  return converted;
}

async function clearUnusedFields(): Promise<number> {
  const documents = await getDocumentsCollection();
  const result = await documents.updateMany(
    { $or: UNUSED_DOCUMENT_FIELDS.map((field) => ({ [field]: { $exists: true } })) },
    { $unset: Object.fromEntries(UNUSED_DOCUMENT_FIELDS.map((field) => [field, ""])) },
  );
  return result.modifiedCount;
}

async function removeDerivedFields(): Promise<Record<string, number>> {
  const documents = await getDocumentsCollection();
  const rawKey = {
    $concat: [`${STORAGE_CONFIG.rawSourcesPrefix}/`, "$sourceType", "/", "$metadata.fileName"],
  };

  const steps: Record<string, { filter: Record<string, unknown>; field: string }> = {
    "citation.sourceType": {
      field: "citation.sourceType",
      filter: {
        "citation.sourceType": { $exists: true },
        $expr: { $eq: ["$citation.sourceType", "$sourceType"] },
      },
    },
    "citation.page": {
      field: "citation.page",
      filter: {
        "citation.page": { $exists: true },
        $expr: { $eq: ["$citation.page", "$metadata.page"] },
      },
    },
    "citation.url (quran)": {
      field: "citation.url",
      filter: {
        sourceType: "quran",
        "citation.url": { $exists: true },
        $expr: {
          $eq: [
            "$citation.url",
            {
              $concat: [
                "https://quran.com/",
                { $toString: "$metadata.surah" },
                "/",
                { $toString: "$metadata.ayah" },
              ],
            },
          ],
        },
      },
    },
    "citation.url (books)": {
      field: "citation.url",
      filter: {
        "citation.url": { $type: "string" },
        "metadata.fileName": { $type: "string" },
        "metadata.restricted": { $ne: true },
        $expr: {
          $and: [
            { $eq: [{ $indexOfCP: ["$citation.url", "#"] }, -1] },
            { $gte: [{ $indexOfCP: ["$citation.url", { $concat: ["/", rawKey] }] }, 0] },
          ],
        },
      },
    },
    "metadata.storageKey": {
      field: "metadata.storageKey",
      filter: {
        "metadata.storageKey": { $exists: true },
        "metadata.fileName": { $type: "string" },
        "metadata.restricted": { $ne: true },
        $expr: {
          $or: [{ $eq: ["$metadata.storageKey", null] }, { $eq: ["$metadata.storageKey", rawKey] }],
        },
      },
    },
  };

  const removed: Record<string, number> = {};
  for (const [name, { filter, field }] of Object.entries(steps)) {
    const result = await documents.updateMany(filter, { $unset: { [field]: "" } });
    removed[name] = result.modifiedCount;
  }
  return removed;
}

async function packContentHashes(): Promise<number> {
  const documents = await getDocumentsCollection();
  let packed = 0;

  for (;;) {
    const batch = await documents
      .find({ contentHash: { $type: "string" } }, { projection: { contentHash: 1 } })
      .limit(BATCH_SIZE * 4)
      .toArray();
    if (batch.length === 0) break;

    const result = await documents.bulkWrite(
      batch.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id, contentHash: doc.contentHash },
          update: {
            $set: { contentHash: new Binary(Buffer.from(String(doc.contentHash), "hex")) },
          },
        },
      })),
      { ordered: false },
    );
    packed += result.modifiedCount;
  }

  return packed;
}

async function removeNullUrls(): Promise<number> {
  const documents = await getDocumentsCollection();
  const result = await documents.updateMany({ "citation.url": { $type: "null" } } as never, {
    $unset: { "citation.url": "" },
  });
  return result.modifiedCount;
}

async function compactBookReferences(): Promise<{ references: number; chapters: number }> {
  const documents = await getDocumentsCollection();
  let references = 0;
  let chapters = 0;

  for (const fileName of bookFileNames()) {
    const cursor = documents.find({ "metadata.fileName": fileName } as never, {
      projection: { sourceType: 1, citation: 1, metadata: 1 },
    });
    let batch: AnyBulkWriteOperation<Document>[] = [];

    const flush = async () => {
      if (batch.length === 0) return;
      await documents.bulkWrite(batch as never, { ordered: false });
      batch = [];
    };

    for await (const row of cursor) {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const full = hydrateReference(row.citation.reference, metadata);
      const reference = storedReference(full, metadata);
      const keepsChapter =
        typeof metadata.chapter === "string" &&
        "chapter" in storedMetadata(metadata, row.sourceType, full);

      const set = reference !== row.citation.reference ? { "citation.reference": reference } : {};
      const unset =
        typeof metadata.chapter === "string" && !keepsChapter ? { "metadata.chapter": "" } : {};
      if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) continue;

      if ("citation.reference" in set) references += 1;
      if ("metadata.chapter" in unset) chapters += 1;
      batch.push({
        updateOne: {
          filter: { _id: row._id, "citation.reference": row.citation.reference },
          update: {
            ...(Object.keys(set).length > 0 ? { $set: set } : {}),
            ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
          },
        },
      });
      if (batch.length >= BATCH_SIZE * 2) await flush();
    }
    await flush();
  }

  return { references, chapters };
}

async function compactHadithGrades(): Promise<number> {
  const documents = await getDocumentsCollection();
  let compacted = 0;

  for (;;) {
    const rows = await documents
      .find({ sourceType: "hadith", "metadata.grades.name": { $exists: true } } as never, {
        projection: { "metadata.grades": 1 },
      })
      .limit(BATCH_SIZE * 2)
      .toArray();
    if (rows.length === 0) break;

    const result = await documents.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: {
              "metadata.grades": encodeGrades(decodeGrades(row.metadata?.grades) ?? []),
            },
          },
        },
      })),
      { ordered: false },
    );
    compacted += result.modifiedCount;
  }

  return compacted;
}

async function stripDirectionalMarks(): Promise<number> {
  const documents = await getDocumentsCollection();
  let stripped = 0;

  for (;;) {
    const rows = await documents
      .find({ content: { $regex: DIRECTIONAL_MARK_PATTERN } } as never, {
        projection: { content: 1 },
      })
      .limit(BATCH_SIZE)
      .toArray();
    if (rows.length === 0) break;

    const result = await documents.bulkWrite(
      rows.map((row) => {
        const content = stripDirectionalMarkCharacters(row.content);
        return {
          updateOne: {
            filter: { _id: row._id, content: row.content },
            update: { $set: { content, contentHash: storedContentHash(content) } },
          },
        };
      }),
      { ordered: false },
    );
    stripped += result.modifiedCount;
  }

  return stripped;
}

export async function optimizeStorage(): Promise<OptimizeReport> {
  const before = await storageUsage();
  logger.info(`Storage before: ${describeUsage(before)}`);

  const provenanceRecorded = await migrateProvenance();
  const notesMoved = await moveQuranNotes();
  const arraysConverted = await convertArrayEmbeddings();
  const fieldsCleared = await clearUnusedFields();
  const derivedFieldsRemoved = await removeDerivedFields();
  const hashesPacked = await packContentHashes();
  const nullUrlsRemoved = await removeNullUrls();
  const compacted = await compactBookReferences();
  if (compacted.references > 0) {
    await (await getDocumentsCollection()).dropIndex(REFERENCE_INDEX_NAME).catch(() => undefined);
  }
  const gradesCompacted = await compactHadithGrades();
  const directionalMarksStripped = await stripDirectionalMarks();
  const { dropped } = await ensureStorageIndexes(await getDb());

  const after = await storageUsage();
  logger.info(`Storage after: ${describeUsage(after)}`);

  return {
    before,
    after,
    provenanceRecorded,
    notesMoved,
    arraysConverted,
    fieldsCleared,
    derivedFieldsRemoved,
    hashesPacked,
    nullUrlsRemoved,
    referencesCompacted: compacted.references,
    chaptersRemoved: compacted.chapters,
    gradesCompacted,
    directionalMarksStripped,
    indexesDropped: dropped,
  };
}
