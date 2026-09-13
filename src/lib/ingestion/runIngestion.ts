import { INGESTION_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { embedTexts } from "@/lib/ai/embeddings";
import { planIngestion } from "@/lib/ingestion/fingerprint";
import { fetchQuranCorpus } from "@/lib/ingestion/sources/quran";
import { fetchHadithCorpus } from "@/lib/ingestion/sources/hadith";
import { loadIjmaDocuments } from "@/lib/ingestion/sources/ijma";
import { loadQiyasDocuments } from "@/lib/ingestion/sources/qiyas";
import { loadSiratDocuments } from "@/lib/ingestion/sources/sirat";
import { countProviders, recordProvenance } from "@/lib/maintenance/provenance";
import {
  applyIngestionPlan,
  attachEmbeddings,
  findUnembedded,
  listIdsNeedingEmbedding,
  loadFingerprints,
} from "@/lib/retrieval/vectorStore";
import { logger } from "@/lib/utils/logger";
import type { IngestionDocument, SourceType } from "@/types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimit(error: unknown): boolean {
  const text = String(error);
  return text.includes("429") || text.includes("RESOURCE_EXHAUSTED") || text.includes("quota");
}

async function embedBatchWaitingOutRateLimits(
  texts: string[],
  sourceType: SourceType,
): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await embedTexts(texts);
    } catch (error) {
      if (!isRateLimit(error) || attempt >= INGESTION_CONFIG.embeddingRateLimitAttempts) {
        throw error;
      }

      logger.warn(
        `${sourceType}: rate limited, waiting ${INGESTION_CONFIG.embeddingRateLimitWaitMs / 1000}s (attempt ${attempt})`,
      );
      await delay(INGESTION_CONFIG.embeddingRateLimitWaitMs);
    }
  }
}

const SOURCE_LOADERS: Record<SourceType, () => Promise<IngestionDocument[]>> = {
  quran: fetchQuranCorpus,
  hadith: fetchHadithCorpus,
  ijma: loadIjmaDocuments,
  qiyas: loadQiyasDocuments,
  sirat: loadSiratDocuments,
};

export interface IngestionOptions {
  replace?: boolean;
  continueOnError?: boolean;
  limit?: number;
  skip?: number;
  textOnly?: boolean;
  dryRun?: boolean;
  embedOnly?: boolean;
}

export interface IngestionReport {
  sourceType: SourceType;
  status: "ingested" | "empty" | "failed" | "planned" | "embedded";
  count: number;
  inserted?: number;
  changed?: number;
  metadataUpdated?: number;
  unchanged?: number;
  duplicatesRemoved?: number;
  staleRemoved?: number;
  embedded?: number;
  error?: string;
}

async function embedMissing(sourceType: SourceType, options: IngestionOptions): Promise<number> {
  const skip = options.skip ?? 0;
  const pendingIds = await listIdsNeedingEmbedding(sourceType);
  const ids = pendingIds.slice(skip, options.limit ? skip + options.limit : undefined);

  logger.info(
    `${sourceType}: ${pendingIds.length} documents lack a current embedding, embedding ${ids.length} this run`,
  );

  let embedded = 0;
  const minBatchIntervalMs = Math.ceil(
    (60_000 * INGESTION_CONFIG.embeddingBatchSize) / INGESTION_CONFIG.embeddingDocsPerMinute,
  );

  for (let start = 0; start < ids.length; start += INGESTION_CONFIG.embeddingBatchSize) {
    const startedAt = Date.now();
    const batch = await findUnembedded(
      ids.slice(start, start + INGESTION_CONFIG.embeddingBatchSize),
    );
    if (batch.length === 0) continue;

    const embeddings = await embedBatchWaitingOutRateLimits(
      batch.map((row) => row.content),
      sourceType,
    );

    embedded += await attachEmbeddings(
      batch.map((row, index) => ({
        id: row.id,
        content: row.content,
        embedding: embeddings[index] as number[],
      })),
    );
    logger.info(`${sourceType}: embedded ${embedded}/${ids.length}`);

    const remaining = minBatchIntervalMs - (Date.now() - startedAt);
    if (remaining > 0 && start + INGESTION_CONFIG.embeddingBatchSize < ids.length) {
      await delay(remaining);
    }
  }

  return embedded;
}

async function ingestSource(
  sourceType: SourceType,
  options: IngestionOptions,
): Promise<IngestionReport> {
  if (options.embedOnly) {
    const embedded = await embedMissing(sourceType, options);
    return { sourceType, status: "embedded", count: embedded, embedded };
  }

  const loaded = await SOURCE_LOADERS[sourceType]();

  if (loaded.length === 0) {
    logger.warn(`No documents found for ${sourceType}`);
    return { sourceType, status: "empty", count: 0 };
  }

  const plan = planIngestion(loaded, await loadFingerprints(sourceType));
  const summary = {
    inserted: plan.inserts.length,
    changed: plan.changed.length,
    metadataUpdated: plan.metadataOnly.length,
    unchanged: plan.unchanged,
    duplicatesRemoved: plan.duplicates.length,
    staleRemoved: options.replace ? plan.stale.length : 0,
  };

  logger.info(
    `${sourceType}: ${summary.inserted} new, ${summary.changed} changed, ${summary.metadataUpdated} metadata-only, ${summary.unchanged} unchanged, ${plan.duplicates.length} duplicates, ${plan.stale.length} no longer in source`,
  );

  if (options.dryRun) {
    return { sourceType, status: "planned", count: summary.inserted + summary.changed, ...summary };
  }

  const result = await applyIngestionPlan(plan, { prune: options.replace ?? false });
  await recordProvenance(sourceType, countProviders(loaded), { replace: true });
  const embedded = options.textOnly ? 0 : await embedMissing(sourceType, options);

  return {
    sourceType,
    status: "ingested",
    count: result.inserted + result.changed,
    ...result,
    unchanged: plan.unchanged,
    embedded,
  };
}

export async function runIngestion(
  sources: readonly SourceType[] = SOURCE_PRIORITY,
  options: IngestionOptions = {},
): Promise<IngestionReport[]> {
  const reports: IngestionReport[] = [];

  for (const sourceType of sources) {
    logger.info(`Ingesting ${sourceType}...`);

    try {
      reports.push(await ingestSource(sourceType, options));
    } catch (error) {
      logger.error(`Ingestion failed for ${sourceType}`, { error: String(error) });
      reports.push({ sourceType, status: "failed", count: 0, error: String(error) });

      if (!options.continueOnError) throw error;
    }
  }

  return reports;
}
