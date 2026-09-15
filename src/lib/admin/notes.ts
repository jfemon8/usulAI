import { z } from "zod";
import { DB_CONFIG } from "@/config/site";
import { AdminError } from "@/lib/admin/http";
import { getDb, getDocumentsCollection } from "@/lib/db/mongoClient";
import { splitSourceBlocks } from "@/lib/ingestion/translations";
import {
  forgetSurahNotes,
  saveSurahNotes,
  unpackSurahNotes,
  type StoredSurahNotes,
  type SurahNotes,
} from "@/lib/retrieval/quranNoteStore";

export const NOTE_LIMITS = {
  translationChars: 10_000,
  footnotesChars: 40_000,
  surahs: 114,
} as const;

export interface SurahSummary {
  number: number;
  name: string;
  ayahs: number;
  noteAyahs: number;
  updatedAt: string | null;
}

export interface AyahEditable {
  ayah: number;
  arabic: string;
  translation: string;
  footnotes: string;
}

export interface SurahForEdit {
  surah: SurahSummary;
  hash: string | null;
  ayahs: AyahEditable[];
}

export const noteChangesInput = z.object({
  baseHash: z.string().max(200).nullable(),
  changes: z
    .array(
      z.object({
        ayah: z.number().int().min(1).max(286),
        translation: z.string().max(NOTE_LIMITS.translationChars),
        footnotes: z.string().max(NOTE_LIMITS.footnotesChars),
      }),
    )
    .min(1)
    .max(286),
});

export type NoteChanges = z.infer<typeof noteChangesInput>;

export function parseSurahNumber(value: string | undefined): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > NOTE_LIMITS.surahs) {
    throw new AdminError("সূরা নম্বর ১ থেকে ১১৪ এর মধ্যে হতে হবে।", 404);
  }
  return number;
}

export function surahNameFromReference(reference: string): string {
  return reference.replace(/\s*\d+:\d+\s*$/, "").trim();
}

let surahNames: Promise<Map<number, { name: string; ayahs: number }>> | null = null;

async function readSurahNames(): Promise<Map<number, { name: string; ayahs: number }>> {
  const rows = await (
    await getDocumentsCollection()
  )
    .aggregate<{ _id: number; ayahs: number; reference: string; surahName?: string }>([
      { $match: { sourceType: "quran" } },
      {
        $group: {
          _id: "$metadata.surah",
          ayahs: { $max: "$metadata.ayah" },
          reference: { $first: "$citation.reference" },
          surahName: { $first: "$metadata.surahName" },
        },
      },
    ])
    .toArray();

  const names = new Map<number, { name: string; ayahs: number }>();
  for (const row of rows) {
    if (typeof row._id !== "number") continue;
    const name =
      typeof row.surahName === "string" && row.surahName.trim()
        ? row.surahName.trim()
        : surahNameFromReference(String(row.reference ?? ""));
    names.set(row._id, { name, ayahs: typeof row.ayahs === "number" ? row.ayahs : 0 });
  }
  return names;
}

function surahNamesOnce(): Promise<Map<number, { name: string; ayahs: number }>> {
  if (!surahNames) {
    surahNames = readSurahNames().then(
      (names) => {
        if (names.size === 0) surahNames = null;
        return names;
      },
      (error: unknown) => {
        surahNames = null;
        throw error;
      },
    );
  }
  return surahNames;
}

async function notesCollection() {
  return (await getDb()).collection<StoredSurahNotes>(DB_CONFIG.quranNotesCollection);
}

export async function listSurahs(): Promise<SurahSummary[]> {
  const [names, stored] = await Promise.all([
    surahNamesOnce(),
    (await notesCollection()).find({}, { projection: { ayahs: 1, updatedAt: 1 } }).toArray(),
  ]);
  const storedBySurah = new Map(stored.map((row) => [row._id, row]));

  return Array.from({ length: NOTE_LIMITS.surahs }, (_, index) => {
    const number = index + 1;
    const row = storedBySurah.get(number);
    const named = names.get(number);
    return {
      number,
      name: named?.name ?? "",
      ayahs: named?.ayahs ?? row?.ayahs ?? 0,
      noteAyahs: row?.ayahs ?? 0,
      updatedAt: row?.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
    };
  });
}

async function readSurah(
  surah: number,
): Promise<{ notes: SurahNotes; hash: string | null; updatedAt: Date | null }> {
  const row = await (await notesCollection()).findOne({ _id: surah });
  if (!row) return { notes: {}, hash: null, updatedAt: null };
  return { notes: unpackSurahNotes(row.notes), hash: row.hash, updatedAt: row.updatedAt ?? null };
}

export async function loadSurahForEdit(surah: number): Promise<SurahForEdit> {
  const [{ notes, hash, updatedAt }, verses, names] = await Promise.all([
    readSurah(surah),
    (await getDocumentsCollection())
      .find(
        { sourceType: "quran", "metadata.surah": surah },
        { projection: { content: 1, "metadata.ayah": 1 } },
      )
      .toArray(),
    surahNamesOnce().catch(() => new Map<number, { name: string; ayahs: number }>()),
  ]);

  const arabicByAyah = new Map<number, string>();
  for (const verse of verses) {
    const ayah = verse.metadata?.ayah;
    if (typeof ayah === "number") arabicByAyah.set(ayah, splitSourceBlocks(verse.content).arabic);
  }

  const numbers = [...new Set([...arabicByAyah.keys(), ...Object.keys(notes).map(Number)])]
    .filter((ayah) => Number.isInteger(ayah) && ayah > 0)
    .sort((left, right) => left - right);

  return {
    surah: {
      number: surah,
      name: names.get(surah)?.name ?? "",
      ayahs: numbers.length,
      noteAyahs: Object.keys(notes).length,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
    },
    hash,
    ayahs: numbers.map((ayah) => ({
      ayah,
      arabic: arabicByAyah.get(ayah) ?? "",
      translation: notes[ayah]?.translation ?? "",
      footnotes: notes[ayah]?.footnotes ?? "",
    })),
  };
}

export function applyNoteChanges(
  notes: SurahNotes,
  changes: NoteChanges["changes"],
  validAyahs: ReadonlySet<number>,
): { notes: SurahNotes; changed: number[] } {
  const next: SurahNotes = { ...notes };
  const changed: number[] = [];

  for (const change of changes) {
    if (!validAyahs.has(change.ayah)) {
      throw new AdminError(`আয়াত ${change.ayah} এই সূরায় নেই।`);
    }
    const translation = change.translation.trim();
    const footnotes = change.footnotes.trim();
    const current = next[change.ayah];
    if (current && current.translation === translation && current.footnotes === footnotes) {
      continue;
    }
    if (!current && translation.length === 0 && footnotes.length === 0) continue;
    next[change.ayah] = { translation, footnotes };
    changed.push(change.ayah);
  }

  return { notes: next, changed };
}

export async function saveSurahEdits(
  surah: number,
  input: NoteChanges,
): Promise<{ changed: number[]; result: SurahForEdit }> {
  const [{ notes, hash }, verses] = await Promise.all([
    readSurah(surah),
    (await getDocumentsCollection())
      .find(
        { sourceType: "quran", "metadata.surah": surah },
        { projection: { "metadata.ayah": 1 } },
      )
      .toArray(),
  ]);

  if (hash !== input.baseHash) {
    throw new AdminError(
      "এই সূরার নোট অন্য কেউ এর মধ্যে বদলেছেন। পাতা রিফ্রেশ করে আবার সম্পাদনা করুন।",
      409,
    );
  }

  const validAyahs = new Set<number>([
    ...verses
      .map((verse) => verse.metadata?.ayah)
      .filter((ayah): ayah is number => typeof ayah === "number"),
    ...Object.keys(notes).map(Number),
  ]);

  const { notes: next, changed } = applyNoteChanges(notes, input.changes, validAyahs);
  if (changed.length > 0) {
    await saveSurahNotes(surah, next);
    forgetSurahNotes(surah);
  }

  return { changed, result: await loadSurahForEdit(surah) };
}
