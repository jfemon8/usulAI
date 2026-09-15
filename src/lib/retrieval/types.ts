import type { RetrievedChunk, SourceType } from "@/types";

export interface SearchOptions {
  maxChunks?: number;
  sources?: readonly SourceType[];
  minSimilarity?: number;
  lazyEmbed?: boolean;
  rerank?: boolean;
  expandSynonyms?: boolean;
  carried?: RetrievedChunk[];
  learningQuestion?: string;
}
