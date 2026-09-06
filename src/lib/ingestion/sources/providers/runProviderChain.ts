import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";
import { logger } from "@/lib/utils/logger";
import type { IngestionDocument, SourceType } from "@/types";

export async function runProviderChain(
  sourceType: SourceType,
  providers: readonly CorpusProvider[],
): Promise<IngestionDocument[]> {
  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.isConfigured()) {
      logger.info(`Skipping ${sourceType} provider "${provider.name}" — not configured`);
      continue;
    }

    try {
      logger.info(`Fetching ${sourceType} from "${provider.name}"`);
      const documents = await provider.fetchAll();

      if (documents.length === 0) {
        errors.push(`${provider.name}: returned 0 documents`);
        logger.warn(`Provider "${provider.name}" returned nothing, trying next`);
        continue;
      }

      logger.info(`Provider "${provider.name}" returned ${documents.length} documents`);
      return documents;
    } catch (error) {
      errors.push(`${provider.name}: ${String(error)}`);
      logger.warn(`Provider "${provider.name}" failed, trying next`, { error: String(error) });
    }
  }

  throw new Error(`Every ${sourceType} provider failed:\n${errors.join("\n")}`);
}
