import { Binary } from "mongodb";
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

export async function optimizeStorage(): Promise<OptimizeReport> {
  const before = await storageUsage();
  logger.info(`Storage before: ${describeUsage(before)}`);

  const provenanceRecorded = await migrateProvenance();
  const notesMoved = await moveQuranNotes();
  const arraysConverted = await convertArrayEmbeddings();
  const fieldsCleared = await clearUnusedFields();
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
    indexesDropped: dropped,
  };
}
