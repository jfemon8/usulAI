import "./loadEnv";
import { QURANENC_CONFIG } from "@/config/site";
import { getMongoClient } from "@/lib/db/mongoClient";
import { saveSurahNotes, type SurahNotes } from "@/lib/retrieval/quranNoteStore";
import { logger } from "@/lib/utils/logger";

interface QuranEncAyah {
  sura: string;
  aya: string;
  translation: string;
  footnotes?: string | null;
}

const SURAH_COUNT = 114;

async function fetchSurah(surah: number): Promise<QuranEncAyah[]> {
  const url = `${QURANENC_CONFIG.baseUrl}/translation/sura/${QURANENC_CONFIG.translationKey}/${surah}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return ((await response.json()) as { result: QuranEncAyah[] }).result;
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }

  throw new Error(`QuranEnc surah ${surah} failed after retries`);
}

async function main() {
  let written = 0;
  let ayahs = 0;

  for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
    const verses = await fetchSurah(surah);
    ayahs += verses.length;

    const notes: SurahNotes = Object.fromEntries(
      verses.map((verse) => [
        Number(verse.aya),
        { translation: verse.translation, footnotes: verse.footnotes ?? "" },
      ]),
    );

    if (await saveSurahNotes(surah, notes)) written += 1;
    if (surah % 20 === 0) logger.info(`QuranEnc: ${surah}/${SURAH_COUNT} surahs checked`);
    await new Promise((resolve) => setTimeout(resolve, QURANENC_CONFIG.requestDelayMs));
  }

  logger.info(`QuranEnc import finished: ${ayahs} ayahs fetched, ${written} surahs written`);
  await (await getMongoClient()).close();
}

void main();
