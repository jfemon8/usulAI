import type { IngestionDocument } from "@/types";

export interface CorpusProvider {
  name: string;
  requiresKey: boolean;
  isConfigured: () => boolean;
  fetchAll: () => Promise<IngestionDocument[]>;
}
