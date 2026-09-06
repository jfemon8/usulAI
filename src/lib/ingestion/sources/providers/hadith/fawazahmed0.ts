import { HADITH_BOOKS } from "@/config/site";
import { fetchJson, mapWithConcurrency } from "@/lib/ingestion/http";
import {
  buildHadithDocument,
  hasUsableText,
  type HadithNarration,
} from "@/lib/ingestion/sources/providers/hadith/narration";
import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";
import { logger } from "@/lib/utils/logger";

const BASE_URL = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1";

interface CdnEditionResponse {
  metadata: { name: string; sections?: Record<string, string> };
  hadiths: {
    hadithnumber: number | string;
    text: string;
    grades?: { grade?: string }[];
    reference?: { book?: number; hadith?: number };
  }[];
}

async function fetchEdition(edition: string): Promise<CdnEditionResponse | null> {
  try {
    return await fetchJson<CdnEditionResponse>(`${BASE_URL}/editions/${edition}.json`, {
      timeoutMs: 120_000,
    });
  } catch (error) {
    logger.warn(`fawazahmed0 hadith edition "${edition}" unavailable`, { error: String(error) });
    return null;
  }
}

function toLookup(edition: CdnEditionResponse | null): Map<string, string> {
  return new Map((edition?.hadiths ?? []).map((entry) => [String(entry.hadithnumber), entry.text]));
}

export const fawazahmed0HadithProvider: CorpusProvider = {
  name: "fawazahmed0-hadith-cdn",
  requiresKey: false,
  isConfigured: () => true,
  fetchAll: async () => {
    const perBook = await mapWithConcurrency(HADITH_BOOKS, 3, async (book) => {
      const [arabicEdition, banglaEdition, englishEdition] = await Promise.all([
        fetchEdition(`ara-${book.slug}`),
        fetchEdition(`${book.translationLanguage}-${book.slug}`),
        fetchEdition(`eng-${book.slug}`),
      ]);

      const primary = englishEdition ?? banglaEdition ?? arabicEdition;
      if (!primary) return [];

      const arabic = toLookup(arabicEdition);
      const bangla = toLookup(banglaEdition);
      const english = toLookup(englishEdition);
      const sections = primary.metadata.sections ?? {};

      return primary.hadiths
        .map<HadithNarration>((entry) => {
          const hadithNumber = String(entry.hadithnumber);

          return {
            collection: book.slug,
            collectionName: book.name,
            hadithNumber,
            arabic: arabic.get(hadithNumber) ?? "",
            bangla: bangla.get(hadithNumber) ?? "",
            english: english.get(hadithNumber) ?? "",
            chapter: entry.reference?.book ? sections[String(entry.reference.book)] : undefined,
            grade: entry.grades?.[0]?.grade,
          };
        })
        .filter(hasUsableText);
    });

    return perBook
      .flat()
      .map((narration) => buildHadithDocument(narration, "fawazahmed0-hadith-cdn"));
  },
};
