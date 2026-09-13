import { buildSourceContent } from "@/lib/ingestion/translations";
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
      collection: narration.collection,
      hadithNumber: narration.hadithNumber,
      chapter: narration.chapter,
    },
    provenance: provider,
  };
}

export function hasUsableText(narration: HadithNarration): boolean {
  return (narration.arabic + narration.bangla + narration.english).trim().length > 0;
}
