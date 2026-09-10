import type { SourceType } from "@/types";

export interface SearchOptions {
  maxChunks?: number;
  sources?: readonly SourceType[];
  minSimilarity?: number;
  lazyEmbed?: boolean;
}
