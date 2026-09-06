import { buildSourceContent, normalizeText } from "@/lib/ingestion/translations";
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

  return {
    sourceType: "quran",
    content: buildSourceContent(verse.arabic, verse.bangla, verse.english),
    citation: {
      sourceType: "quran",
      reference,
      url: `https://quran.com/${verse.surah}/${verse.ayah}`,
    },
    metadata: {
      provider,
      surah: verse.surah,
      ayah: verse.ayah,
      surahName: surahName || undefined,
      hasBangla: normalizeText(verse.bangla).length > 0,
      hasEnglish: normalizeText(verse.english).length > 0,
    },
  };
}
