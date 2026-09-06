import { QURAN_EDITIONS } from "@/config/site";
import { fetchJson } from "@/lib/ingestion/http";
import { buildVerseDocument, type QuranVerse } from "@/lib/ingestion/sources/providers/quran/verse";
import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";

const BASE_URL = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1";

interface CdnEditionResponse {
  quran: { chapter: number; verse: number; text: string }[];
}

async function fetchEdition(edition: string): Promise<CdnEditionResponse["quran"]> {
  const response = await fetchJson<CdnEditionResponse>(`${BASE_URL}/editions/${edition}.json`, {
    timeoutMs: 120_000,
  });
  return response.quran;
}

function toLookup(entries: CdnEditionResponse["quran"]): Map<string, string> {
  return new Map(entries.map((entry) => [`${entry.chapter}:${entry.verse}`, entry.text]));
}

export const fawazahmed0QuranProvider: CorpusProvider = {
  name: "fawazahmed0-quran-cdn",
  requiresKey: false,
  isConfigured: () => true,
  fetchAll: async () => {
    const [arabic, banglaEntries, englishEntries] = await Promise.all([
      fetchEdition(QURAN_EDITIONS.fawazahmed0.arabic),
      fetchEdition(QURAN_EDITIONS.fawazahmed0.bangla),
      fetchEdition(QURAN_EDITIONS.fawazahmed0.english),
    ]);

    const bangla = toLookup(banglaEntries);
    const english = toLookup(englishEntries);

    const verses = arabic.map<QuranVerse>((entry) => {
      const key = `${entry.chapter}:${entry.verse}`;

      return {
        surah: entry.chapter,
        ayah: entry.verse,
        surahName: "",
        arabic: entry.text,
        bangla: bangla.get(key) ?? "",
        english: english.get(key) ?? "",
      };
    });

    return verses.map((verse) => buildVerseDocument(verse, "fawazahmed0-quran-cdn"));
  },
};
