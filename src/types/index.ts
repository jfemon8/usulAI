import type { UIMessage } from "ai";
import type { SOURCE_PRIORITY } from "@/config/site";

export type SourceType = (typeof SOURCE_PRIORITY)[number];

export interface SourceCitation {
  sourceType: SourceType;
  reference: string;
  url?: string;
}

export interface RetrievedChunk {
  id: string;
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  similarity: number;
  retrievedBy: "vector" | "text";
}

export interface IngestionDocument {
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  metadata?: Record<string, unknown>;
}

export interface AnswerSource {
  index: number;
  sourceType: SourceType;
  reference: string;
  url?: string;
  similarity: number;
}

export type UsulDataParts = {
  sources: AnswerSource[];
};

export type UsulUIMessage = UIMessage<never, UsulDataParts>;
