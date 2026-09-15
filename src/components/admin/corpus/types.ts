import type { SourceType } from "@/types";

export const CORPUS_SOURCE_LABELS: Record<SourceType, string> = {
  quran: "কুরআন",
  hadith: "হাদিস",
  ijma: "ইজমা",
  qiyas: "কিয়াস",
  sirat: "সীরাত ও জীবনী",
  fiqh: "ফিকহ ও ফতোয়া",
};

export interface CorpusRow {
  id: string;
  sourceType: SourceType;
  reference: string;
  preview: string;
  embedded: boolean;
  adminEdited: boolean;
  restricted: boolean;
  score?: number;
}

export type CorpusListMode = "list" | "id" | "reference" | "search";

export interface CorpusListResponse {
  mode: CorpusListMode;
  items: CorpusRow[];
  nextCursor: string | null;
  limited: boolean;
}

export interface CorpusSourceStat {
  sourceType: SourceType;
  total: number;
  embedded: number;
}

export interface CorpusStatsResponse {
  sources: CorpusSourceStat[];
  total: number;
  embedded: number;
}

export interface CitationFieldInput {
  key: string;
  value: string;
}

export interface CorpusDocumentView {
  id: string;
  sourceType: SourceType;
  reference: string;
  content: string;
  citation: CitationFieldInput[];
  metadata: string;
  embedded: boolean;
  embeddingModel: string | null;
  contentHash: string | null;
  restricted: boolean;
  adminEdited: boolean;
  adminEditedAt: string | null;
}

export interface CorpusEditPayload {
  sourceType: SourceType;
  reference: string;
  content: string;
  citation: CitationFieldInput[];
  metadata: string;
}
