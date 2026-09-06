import { QURAN_EDITIONS } from "@/config/site";
import { fetchJson } from "@/lib/ingestion/http";
import { buildVerseDocument, type QuranVerse } from "@/lib/ingestion/sources/providers/quran/verse";
import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";
import { getSourcesEnv } from "@/lib/utils/env";

interface AlquranAyah {
  numberInSurah: number;
  text: string;
}

interface AlquranSurah {
  number: number;
  name: string;
  englishName: string;
  ayahs: AlquranAyah[];
}

interface AlquranEditionResponse {
  data: { surahs: AlquranSurah[] };
}

async function fetchEdition(baseUrl: string, edition: string): Promise<AlquranSurah[]> {
  const response = await fetchJson<AlquranEditionResponse>(`${baseUrl}/quran/${edition}`, {
    timeoutMs: 120_000,
  });
  return response.data.surahs;
}

function toLookup(surahs: AlquranSurah[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const surah of surahs) {
    for (const ayah of surah.ayahs) {
      lookup.set(`${surah.number}:${ayah.numberInSurah}`, ayah.text);
    }
  }

  return lookup;
}

export const alquranCloudProvider: CorpusProvider = {
  name: "alquran.cloud",
  requiresKey: false,
  isConfigured: () => true,
  fetchAll: async () => {
    const baseUrl = getSourcesEnv().QURAN_API_BASE_URL.replace(/\/+$/, "");

    const [arabicSurahs, banglaSurahs, englishSurahs] = await Promise.all([
      fetchEdition(baseUrl, QURAN_EDITIONS.alquranCloud.arabic),
      fetchEdition(baseUrl, QURAN_EDITIONS.alquranCloud.bangla),
      fetchEdition(baseUrl, QURAN_EDITIONS.alquranCloud.english),
    ]);

    const bangla = toLookup(banglaSurahs);
    const english = toLookup(englishSurahs);

    const verses: QuranVerse[] = [];
    for (const surah of arabicSurahs) {
      for (const ayah of surah.ayahs) {
        const key = `${surah.number}:${ayah.numberInSurah}`;

        verses.push({
          surah: surah.number,
          ayah: ayah.numberInSurah,
          surahName: surah.englishName,
          arabic: ayah.text,
          bangla: bangla.get(key) ?? "",
          english: english.get(key) ?? "",
        });
      }
    }

    return verses.map((verse) => buildVerseDocument(verse, "alquran.cloud"));
  },
};
