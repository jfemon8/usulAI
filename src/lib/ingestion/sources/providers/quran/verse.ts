import { buildSourceContent, normalizeText } from "@/lib/ingestion/translations";
import {
  BROKEN_ENTITY,
  repairBanglaTranslation,
} from "@/lib/ingestion/sources/providers/quran/repairs";
import { logger } from "@/lib/utils/logger";
import type { IngestionDocument } from "@/types";

export interface QuranVerse {
  surah: number;
  ayah: number;
  surahName: string;
  arabic: string;
  bangla: string;
  english: string;
}

export function buildVerseDocument(verse: QuranVerse, provider: string): IngestionDocument {
  const surahName = normalizeText(verse.surahName);
  const reference = surahName
    ? `${surahName} ${verse.surah}:${verse.ayah}`
    : `কুরআন ${verse.surah}:${verse.ayah}`;

  const bangla = repairBanglaTranslation(verse.surah, verse.ayah, verse.bangla);
  if (BROKEN_ENTITY.test(bangla)) {
    logger.warn(
      `Quran ${verse.surah}:${verse.ayah} Bangla translation still carries a broken entity`,
    );
  }

  return {
    sourceType: "quran",
    content: buildSourceContent(verse.arabic, bangla, verse.english),
    citation: {
      sourceType: "quran",
      reference,
      url: `https://quran.com/${verse.surah}/${verse.ayah}`,
    },
    metadata: {
      surah: verse.surah,
      ayah: verse.ayah,
      surahName: surahName || undefined,
    },
    provenance: provider,
  };
}
