import { QURAN_NOTE_SEARCH_CONFIG } from "@/config/site";
import { topicQuery } from "@/lib/retrieval/questionFiller";
import { eachSurahNotes, type SurahNotes } from "@/lib/retrieval/quranNoteStore";
import { expandQueryTerms } from "@/lib/retrieval/synonyms";
import { composeNukta } from "@/lib/utils/bangla";
import { logger } from "@/lib/utils/logger";

export interface NoteHit {
  surah: number;
  ayah: number;
  score: number;
}

export interface QuranNoteIndex {
  ayahs: { surah: number; ayah: number; length: number }[];
  vocabulary: string[];
  postings: Map<string, [number, number][]>;
  averageLength: number;
}

function tokenize(text: string): string[] {
  return composeNukta(text.toLowerCase())
    .split(/[^\p{L}\p{M}]+/u)
    .filter((word) => word.length >= QURAN_NOTE_SEARCH_CONFIG.minTermChars);
}

export function buildQuranNoteIndex(surahs: Iterable<[number, SurahNotes]>): QuranNoteIndex {
  const ayahs: QuranNoteIndex["ayahs"] = [];
  const postings = new Map<string, [number, number][]>();

  for (const [surah, notes] of surahs) {
    for (const [ayah, note] of Object.entries(notes)) {
      const tokens = tokenize(`${note.translation} ${note.footnotes}`);
      const counts = new Map<string, number>();
      for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

      const position = ayahs.length;
      ayahs.push({ surah, ayah: Number(ayah), length: tokens.length });
      for (const [token, count] of counts) {
        const list = postings.get(token);
        if (list) list.push([position, count]);
        else postings.set(token, [[position, count]]);
      }
    }
  }

  const averageLength = ayahs.reduce((sum, entry) => sum + entry.length, 0) / (ayahs.length || 1);
  return { ayahs, vocabulary: [...postings.keys()].sort(), postings, averageLength };
}

function formsOf(index: QuranNoteIndex, term: string): string[] {
  let low = 0;
  let high = index.vocabulary.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (index.vocabulary[middle]! < term) low = middle + 1;
    else high = middle;
  }

  const forms: string[] = [];
  for (let at = low; at < index.vocabulary.length; at += 1) {
    const word = index.vocabulary[at]!;
    if (!word.startsWith(term)) break;
    if (word.length - term.length <= QURAN_NOTE_SEARCH_CONFIG.maxSuffixChars) forms.push(word);
  }
  return forms;
}

export function searchQuranNoteIndex(
  index: QuranNoteIndex,
  query: string,
  limit: number,
  expandSynonyms = true,
): NoteHit[] {
  const { k1, b, minScore } = QURAN_NOTE_SEARCH_CONFIG;
  const terms = [
    ...new Set(
      [...tokenize(topicQuery(query)), ...(expandSynonyms ? expandQueryTerms(query) : [])].map(
        (term) => composeNukta(term.toLowerCase()),
      ),
    ),
  ].filter((term) => term.length >= QURAN_NOTE_SEARCH_CONFIG.minTermChars);

  const total = index.ayahs.length;
  const scores = new Map<number, number>();

  for (const term of terms) {
    const frequencies = new Map<number, number>();
    for (const form of formsOf(index, term)) {
      for (const [position, count] of index.postings.get(form) ?? []) {
        frequencies.set(position, (frequencies.get(position) ?? 0) + count);
      }
    }
    if (frequencies.size === 0) continue;

    const idf = Math.log(1 + (total - frequencies.size + 0.5) / (frequencies.size + 0.5));
    for (const [position, frequency] of frequencies) {
      const length = index.ayahs[position]!.length;
      const weight =
        (frequency * (k1 + 1)) / (frequency + k1 * (1 - b + (b * length) / index.averageLength));
      scores.set(position, (scores.get(position) ?? 0) + idf * weight);
    }
  }

  return [...scores]
    .filter(([, score]) => score >= minScore)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([position, score]) => ({ ...index.ayahs[position]!, score }));
}

let building: Promise<QuranNoteIndex> | null = null;

async function loadIndex(): Promise<QuranNoteIndex> {
  const started = Date.now();
  const surahs: [number, SurahNotes][] = [];
  for await (const entry of eachSurahNotes()) surahs.push(entry);
  const index = buildQuranNoteIndex(surahs);
  logger.info(`Built the tafsir note index over ${index.ayahs.length} ayahs`, {
    ms: Date.now() - started,
    terms: index.vocabulary.length,
  });
  return index;
}

export async function searchQuranNotes(
  query: string,
  limit: number,
  expandSynonyms = true,
): Promise<NoteHit[]> {
  if (!building) {
    building = loadIndex().catch((error: unknown) => {
      building = null;
      throw error;
    });
  }

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const index = await Promise.race([
      building,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), QURAN_NOTE_SEARCH_CONFIG.readyWaitMs);
      }),
    ]).finally(() => clearTimeout(timer));
    return index ? searchQuranNoteIndex(index, query, limit, expandSynonyms) : [];
  } catch (error) {
    logger.warn("Tafsir note search unavailable", { error: String(error).slice(0, 160) });
    return [];
  }
}
