import type { UIMessage } from "ai";
import type { SOURCE_PRIORITY } from "@/config/site";

export type SourceType = (typeof SOURCE_PRIORITY)[number];

export type CitationMedia = "web" | "image" | "pdf";

export interface SourceCitation {
  sourceType: SourceType;
  reference: string;
  url?: string;
  media?: CitationMedia;
  page?: number;
  pageCount?: number;
}

export interface HadithGrade {
  name: string;
  grade: string;
}

export interface TranslatedSegment {
  arabic: string;
  vocalized?: string;
  bangla: string;
  english: string;
}

export interface RetrievedChunk {
  id: string;
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  similarity: number;
  retrievedBy: "vector" | "text" | "history";
  grades?: HadithGrade[];
  note?: string;
  vocalized?: string;
  machineTranslated?: boolean;
  segments?: TranslatedSegment[];
}

export interface IngestionDocument {
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  metadata?: Record<string, unknown>;
  provenance?: string;
}

export interface AnswerSource {
  index: number;
  sourceType: SourceType;
  reference: string;
  url?: string;
  media?: CitationMedia;
  page?: number;
  pageCount?: number;
  similarity: number;
  grade?: string;
}

export interface AnswerOutcome {
  retryable: boolean;
}

export type UsulDataParts = {
  sources: AnswerSource[];
  outcome: AnswerOutcome;
};

export type UsulUIMessage = UIMessage<never, UsulDataParts>;
