import { Binary } from "mongodb";
import { STORAGE_CONFIG } from "@/config/site";
import { getDb, getDocumentsCollection } from "@/lib/db/mongoClient";
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

export interface OptimizeReport {
  before: StorageUsage;
  after: StorageUsage;
  provenanceRecorded: number;
  notesMoved: number;
  arraysConverted: number;
  fieldsCleared: number;
  derivedFieldsRemoved: Record<string, number>;
  hashesPacked: number;
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

export async function optimizeStorage(): Promise<OptimizeReport> {
  const before = await storageUsage();
  logger.info(`Storage before: ${describeUsage(before)}`);

  const provenanceRecorded = await migrateProvenance();
  const notesMoved = await moveQuranNotes();
  const arraysConverted = await convertArrayEmbeddings();
  const fieldsCleared = await clearUnusedFields();
  const derivedFieldsRemoved = await removeDerivedFields();
  const hashesPacked = await packContentHashes();
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
    indexesDropped: dropped,
  };
}
