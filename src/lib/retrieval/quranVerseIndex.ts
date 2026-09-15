import { DB_CONFIG, QURAN_VERSE_LOOKUP_CONFIG } from "@/config/site";
import { arabicSkeleton } from "@/lib/ai/arabicText";
import { getDb } from "@/lib/db/mongoClient";
import { splitSourceBlocks } from "@/lib/ingestion/translations";
import { logger } from "@/lib/utils/logger";

export interface QuranVerse {
  reference: string;
  surah: number;
  ayah: number;
  arabic: string;
  bangla?: string;
  english?: string;
}

interface IndexedVerse extends QuranVerse {
  raw: string[];
  letters: string;
  letterToken: number[];
}

export interface QuranVerseIndex {
  verses: IndexedVerse[];
  postings: Map<string, number[]>;
}

export interface VerseMatch {
  verse: QuranVerse;
  segment: string;
  matchedLetters: number;
}

const ALEF_LIKE = /[اى]/g;

function wordLetters(token: string): string {
  return arabicSkeleton(token).replace(ALEF_LIKE, "");
}

function lettersOf(text: string): { raw: string[]; letters: string; letterToken: number[] } {
  const raw: string[] = [];
  let letters = "";
  const letterToken: number[] = [];
  for (const token of text.split(/\s+/)) {
    const word = wordLetters(token);
    if (!word) continue;
    raw.push(token);
    for (const letter of word) {
      letters += letter;
      letterToken.push(raw.length - 1);
    }
  }
  return { raw, letters, letterToken };
}

function postingKeys(letters: string): string[] {
  const keys = new Set<string>();
  const size = QURAN_VERSE_LOOKUP_CONFIG.shingleLetters;
  for (let start = 0; start + size <= letters.length; start += 1) {
    keys.add(letters.slice(start, start + size));
  }
  return [...keys];
}

export function buildQuranVerseIndex(verses: Iterable<QuranVerse>): QuranVerseIndex {
  const indexed: IndexedVerse[] = [];
  const postings = new Map<string, number[]>();

  for (const verse of verses) {
    const { raw, letters, letterToken } = lettersOf(verse.arabic);
    const position = indexed.length;
    indexed.push({ ...verse, raw, letters, letterToken });
    for (const key of postingKeys(letters)) {
      const list = postings.get(key);
      if (list) list.push(position);
      else postings.set(key, [position]);
    }
  }

  return { verses: indexed, postings };
}

function longestCommonSubstring(quote: string, verse: string): { length: number; end: number } {
  let previous = new Array<number>(verse.length + 1).fill(0);
  let best = { length: 0, end: 0 };
  for (let q = 1; q <= quote.length; q += 1) {
    const current = new Array<number>(verse.length + 1).fill(0);
    for (let v = 1; v <= verse.length; v += 1) {
      if (quote[q - 1] !== verse[v - 1]) continue;
      current[v] = previous[v - 1]! + 1;
      if (current[v]! > best.length) best = { length: current[v]!, end: v };
    }
    previous = current;
  }
  return best;
}

export function findQuranVerse(index: QuranVerseIndex, quote: string): VerseMatch | null {
  const { raw, letters } = lettersOf(quote);
  if (raw.length < QURAN_VERSE_LOOKUP_CONFIG.minQuoteWords) return null;

  const hits = new Map<number, number>();
  for (const key of postingKeys(letters)) {
    for (const position of index.postings.get(key) ?? []) {
      hits.set(position, (hits.get(position) ?? 0) + 1);
    }
  }

  const candidates = [...hits.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, QURAN_VERSE_LOOKUP_CONFIG.candidates);

  let best: { verse: IndexedVerse; length: number; end: number } | null = null;
  for (const [position] of candidates) {
    const verse = index.verses[position]!;
    const common = longestCommonSubstring(letters, verse.letters);
    if (common.length > (best?.length ?? 0)) best = { verse, ...common };
  }

  const needed = Math.max(
    QURAN_VERSE_LOOKUP_CONFIG.minMatchLetters,
    Math.ceil(letters.length * QURAN_VERSE_LOOKUP_CONFIG.minMatchRatio),
  );
  if (!best || best.length < Math.min(needed, letters.length)) return null;

  const firstToken = best.verse.letterToken[best.end - best.length]!;
  const lastToken = best.verse.letterToken[best.end - 1]!;
  return {
    verse: best.verse,
    segment: best.verse.raw.slice(firstToken, lastToken + 1).join(" "),
    matchedLetters: best.length,
  };
}

let index: QuranVerseIndex | null = null;
let loading: Promise<QuranVerseIndex | null> | null = null;

async function loadIndex(): Promise<QuranVerseIndex | null> {
  const started = Date.now();
  try {
    const rows = await (
      await getDb()
    )
      .collection<{
        content: string;
        citation: { reference: string };
        metadata?: { surah?: number; ayah?: number };
      }>(DB_CONFIG.collection)
      .find(
        { sourceType: "quran" },
        {
          projection: {
            content: 1,
            "citation.reference": 1,
            "metadata.surah": 1,
            "metadata.ayah": 1,
          },
        },
      )
      .toArray();

    index = buildQuranVerseIndex(
      rows.map((row) => {
        const blocks = splitSourceBlocks(row.content);
        return {
          reference: row.citation.reference,
          surah: row.metadata?.surah ?? 0,
          ayah: row.metadata?.ayah ?? 0,
          arabic: blocks.arabic,
          ...(blocks.bangla ? { bangla: blocks.bangla } : {}),
          ...(blocks.english ? { english: blocks.english } : {}),
        };
      }),
    );
    logger.info(`Built the Quran verse index over ${index.verses.length} ayahs`, {
      ms: Date.now() - started,
    });
    return index;
  } catch (error) {
    logger.warn("Quran verse index unavailable", { error: String(error).slice(0, 160) });
    return null;
  } finally {
    loading = null;
  }
}

export function quranVerseIndex(): QuranVerseIndex | null {
  if (!index && !loading) loading = loadIndex();
  return index;
}

export async function quranVerseIndexReady(waitMs: number): Promise<QuranVerseIndex | null> {
  if (index) return index;
  if (!loading) loading = loadIndex();
  const pending = loading;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    pending,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), waitMs);
    }),
  ]);
  clearTimeout(timer);
  return result;
}
