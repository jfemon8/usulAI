import { QURAN_EDITIONS } from "@/config/site";
import { fetchJson, mapWithConcurrency } from "@/lib/ingestion/http";
import { buildVerseDocument, type QuranVerse } from "@/lib/ingestion/sources/providers/quran/verse";
import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";

const BASE_URL = "https://api.quran.com/api/v4";

interface ChaptersResponse {
  chapters: { id: number; name_simple: string; verses_count: number }[];
}

interface ByChapterResponse {
  verses: {
    verse_key: string;
    text_uthmani: string;
    translations?: { resource_id: number; text: string }[];
  }[];
}

function stripHtml(value: string): string {
  return value
    .replace(/<sup[^>]*>.*?<\/sup>/gs, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export const quranComProvider: CorpusProvider = {
  name: "quran.com",
  requiresKey: false,
  isConfigured: () => true,
  fetchAll: async () => {
    const { chapters } = await fetchJson<ChaptersResponse>(`${BASE_URL}/chapters`);
    const { banglaTranslationId, englishTranslationId } = QURAN_EDITIONS.quranCom;

    const perChapter = await mapWithConcurrency(chapters, 4, async (chapter) => {
      const { verses } = await fetchJson<ByChapterResponse>(
        `${BASE_URL}/verses/by_chapter/${chapter.id}` +
          `?translations=${banglaTranslationId},${englishTranslationId}` +
          `&fields=text_uthmani&per_page=${chapter.verses_count}`,
      );

      return verses.map<QuranVerse>((verse) => {
        const ayahNumber = Number(verse.verse_key.split(":")[1]);
        const find = (id: number) =>
          stripHtml(
            verse.translations?.find((translation) => translation.resource_id === id)?.text ?? "",
          );

        return {
          surah: chapter.id,
          ayah: ayahNumber,
          surahName: chapter.name_simple,
          arabic: verse.text_uthmani,
          bangla: find(banglaTranslationId),
          english: find(englishTranslationId),
        };
      });
    });

    return perChapter.flat().map((verse) => buildVerseDocument(verse, "quran.com"));
  },
};
