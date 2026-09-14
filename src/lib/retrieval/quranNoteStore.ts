import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { Binary } from "mongodb";
import { DB_CONFIG, QURANENC_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { contentHash } from "@/lib/ingestion/fingerprint";
import { createLru } from "@/lib/utils/lru";

export interface AyahNote {
  translation: string;
  footnotes: string;
}

export type SurahNotes = Record<number, AyahNote>;

export interface StoredSurahNotes {
  _id: number;
  notes: Binary;
  hash: string;
  ayahs: number;
  source: string;
  key: string;
  updatedAt: Date;
}

export function packSurahNotes(notes: SurahNotes): { notes: Binary; hash: string; bytes: number } {
  const json = JSON.stringify(notes);
  const compressed = brotliCompressSync(Buffer.from(json, "utf8"), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  });

  return { notes: new Binary(compressed), hash: contentHash(json), bytes: compressed.length };
}

export function unpackSurahNotes(notes: Binary): SurahNotes {
  return JSON.parse(brotliDecompressSync(Buffer.from(notes.buffer)).toString("utf8")) as SurahNotes;
}

const cache = createLru<SurahNotes>(QURANENC_CONFIG.notesCacheSurahs);

async function notesCollection() {
  return (await getDb()).collection<StoredSurahNotes>(DB_CONFIG.quranNotesCollection);
}

export async function loadSurahNotes(surahs: number[]): Promise<Map<number, SurahNotes>> {
  const result = new Map<number, SurahNotes>();
  const missing: number[] = [];

  for (const surah of new Set(surahs)) {
    const cached = cache.get(String(surah));
    if (cached) result.set(surah, cached);
    else missing.push(surah);
  }

  if (missing.length === 0) return result;

  const rows = await (
    await notesCollection()
  )
    .find({ _id: { $in: missing } }, { projection: { notes: 1 } })
    .toArray();

  for (const row of rows) {
    const notes = unpackSurahNotes(row.notes);
    cache.set(String(row._id), notes);
    result.set(row._id, notes);
  }

  return result;
}

export async function* eachSurahNotes(): AsyncGenerator<[number, SurahNotes]> {
  const cursor = (await notesCollection()).find({}, { projection: { notes: 1 } });
  for await (const row of cursor) yield [row._id, unpackSurahNotes(row.notes)];
}

export async function saveSurahNotes(surah: number, notes: SurahNotes): Promise<boolean> {
  const packed = packSurahNotes(notes);
  const collection = await notesCollection();

  const result = await collection.updateOne(
    { _id: surah, hash: { $ne: packed.hash } },
    {
      $set: {
        notes: packed.notes,
        hash: packed.hash,
        ayahs: Object.keys(notes).length,
        source: "QuranEnc.com",
        key: QURANENC_CONFIG.translationKey,
        updatedAt: new Date(),
      },
    },
    { upsert: false },
  );

  if (result.matchedCount > 0) return true;

  const exists = await collection.countDocuments({ _id: surah }, { limit: 1 });
  if (exists > 0) return false;

  await collection.insertOne({
    _id: surah,
    notes: packed.notes,
    hash: packed.hash,
    ayahs: Object.keys(notes).length,
    source: "QuranEnc.com",
    key: QURANENC_CONFIG.translationKey,
    updatedAt: new Date(),
  });
  return true;
}
