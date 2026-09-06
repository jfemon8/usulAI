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

const BASE_URL = "https://api.sunnah.com/v1";
const PAGE_SIZE = 100;

interface SunnahResponse {
  data?: {
    hadithNumber?: string | number;
    hadith?: {
      lang?: string;
      body?: string;
      chapterTitle?: string;
      grades?: { grade?: string }[];
    }[];
  }[];
  total?: number;
  next?: number | null;
}

export const sunnahComProvider: CorpusProvider = {
  name: "sunnah.com",
  requiresKey: true,
  isConfigured: () => Boolean(process.env.SUNNAH_API_KEY),
  fetchAll: async () => {
    const apiKey = getSourcesEnv().SUNNAH_API_KEY;

    if (!apiKey) {
      throw new Error("sunnah.com: SUNNAH_API_KEY is not set");
    }

    const narrations: HadithNarration[] = [];

    for (const book of HADITH_BOOKS) {
      if (!book.sunnahComSlug) {
        logger.info(`sunnah.com has no collection for "${book.slug}", skipping`);
        continue;
      }

      let page = 1;

      for (;;) {
        const url = `${BASE_URL}/collections/${book.sunnahComSlug}/hadiths?page=${page}&limit=${PAGE_SIZE}`;
        const response = await fetchJson<SunnahResponse>(url, {
          headers: { "X-API-Key": apiKey },
        });

        const rows = response.data ?? [];
        if (rows.length === 0) break;

        for (const row of rows) {
          const arabicEntry = row.hadith?.find((entry) => entry.lang === "ar");
          const englishEntry = row.hadith?.find((entry) => entry.lang === "en");

          narrations.push({
            collection: book.slug,
            collectionName: book.name,
            hadithNumber: String(row.hadithNumber ?? ""),
            arabic: arabicEntry?.body ?? "",
            bangla: "",
            english: englishEntry?.body ?? "",
            chapter: englishEntry?.chapterTitle ?? arabicEntry?.chapterTitle,
            grade: englishEntry?.grades?.[0]?.grade,
          });
        }

        if (!response.next) break;
        page += 1;
      }

      logger.info(`sunnah.com: fetched ${book.slug}`, { total: narrations.length });
    }

    return narrations
      .filter(hasUsableText)
      .map((narration) => buildHadithDocument(narration, "sunnah.com"));
  },
};
