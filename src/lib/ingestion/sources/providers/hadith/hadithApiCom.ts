import { HADITH_BOOKS } from "@/config/site";
import { fetchJson } from "@/lib/ingestion/http";
import {
  buildHadithDocument,
  hasUsableText,
  type HadithNarration,
} from "@/lib/ingestion/sources/providers/hadith/narration";
import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";
import { getSourcesEnv } from "@/lib/utils/env";
import { logger } from "@/lib/utils/logger";

const DEFAULT_BASE_URL = "https://hadithapi.com/api";
const PAGE_SIZE = 100;

interface HadithApiResponse {
  hadiths?: {
    current_page?: number;
    last_page?: number;
    data?: {
      hadithNumber?: string | number;
      hadithArabic?: string;
      hadithEnglish?: string;
      hadithUrdu?: string;
      status?: string;
      chapter?: { chapterEnglish?: string };
    }[];
  };
}

export const hadithApiComProvider: CorpusProvider = {
  name: "hadithapi.com",
  requiresKey: true,
  isConfigured: () => Boolean(process.env.HADITH_API_KEY),
  fetchAll: async () => {
    const env = getSourcesEnv();
    const apiKey = env.HADITH_API_KEY;

    if (!apiKey) {
      throw new Error("hadithapi.com: HADITH_API_KEY is not set");
    }

    const baseUrl = (env.HADITH_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const narrations: HadithNarration[] = [];

    for (const book of HADITH_BOOKS) {
      if (!book.hadithApiComSlug) {
        logger.info(`hadithapi.com has no edition for "${book.slug}", skipping`);
        continue;
      }

      let page = 1;
      let lastPage = 1;

      do {
        const url =
          `${baseUrl}/hadiths?apiKey=${encodeURIComponent(apiKey)}` +
          `&book=${book.hadithApiComSlug}&paginate=${PAGE_SIZE}&page=${page}`;

        const response = await fetchJson<HadithApiResponse>(url);
        const rows = response.hadiths?.data ?? [];
        lastPage = response.hadiths?.last_page ?? page;

        for (const row of rows) {
          narrations.push({
            collection: book.slug,
            collectionName: book.name,
            hadithNumber: String(row.hadithNumber ?? ""),
            arabic: row.hadithArabic ?? "",
            bangla: "",
            english: row.hadithEnglish ?? "",
            chapter: row.chapter?.chapterEnglish,
            grade: row.status,
          });
        }

        page += 1;
      } while (page <= lastPage);

      logger.info(`hadithapi.com: fetched ${book.slug}`, { total: narrations.length });
    }

    return narrations
      .filter(hasUsableText)
      .map((narration) => buildHadithDocument(narration, "hadithapi.com"));
  },
};
