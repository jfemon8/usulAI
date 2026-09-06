import { buildSourceContent, normalizeText } from "@/lib/ingestion/translations";
import type { IngestionDocument } from "@/types";

export interface HadithNarration {
  collection: string;
  collectionName: string;
  hadithNumber: string;
  arabic: string;
  bangla: string;
  english: string;
  chapter?: string;
  grade?: string;
}

export function buildHadithDocument(
  narration: HadithNarration,
  provider: string,
): IngestionDocument {
  return {
    sourceType: "hadith",
    content: buildSourceContent(narration.arabic, narration.bangla, narration.english),
    citation: {
      sourceType: "hadith",
      reference: `${narration.collectionName} ${narration.hadithNumber}`,
    },
    metadata: {
      provider,
      collection: narration.collection,
      hadithNumber: narration.hadithNumber,
      chapter: narration.chapter,
      grade: narration.grade,
      hasBangla: normalizeText(narration.bangla).length > 0,
      hasEnglish: normalizeText(narration.english).length > 0,
    },
  };
}

export function hasUsableText(narration: HadithNarration): boolean {
  return (narration.arabic + narration.bangla + narration.english).trim().length > 0;
}
