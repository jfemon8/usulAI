import { INGESTION_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { embedTexts } from "@/lib/ai/embeddings";
import { fetchQuranCorpus } from "@/lib/ingestion/sources/quran";
import { fetchHadithCorpus } from "@/lib/ingestion/sources/hadith";
import { loadIjmaDocuments } from "@/lib/ingestion/sources/ijma";
import { loadQiyasDocuments } from "@/lib/ingestion/sources/qiyas";
import { loadSiratDocuments } from "@/lib/ingestion/sources/sirat";
import { deleteSourceChunks, existingReferences, upsertChunks } from "@/lib/retrieval/vectorStore";
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
  resume?: boolean;
}

export interface IngestionReport {
  sourceType: SourceType;
  status: "ingested" | "empty" | "failed";
  count: number;
  error?: string;
}

async function ingestSource(
  sourceType: SourceType,
  options: IngestionOptions,
): Promise<IngestionReport> {
  const loaded = await SOURCE_LOADERS[sourceType]();

  if (loaded.length === 0) {
    logger.warn(`No documents found for ${sourceType}`);
    return { sourceType, status: "empty", count: 0 };
  }

  if (options.replace) {
    const removed = await deleteSourceChunks(sourceType);
    logger.info(`Removed ${removed} existing ${sourceType} chunks before re-ingest`);
  }

  const skip = options.skip ?? 0;
  let documents = loaded.slice(skip, options.limit ? skip + options.limit : undefined);

  if (options.resume && !options.replace) {
    const already = await existingReferences(sourceType);
    const before = documents.length;
    documents = documents.filter((document) => !already.has(document.citation.reference));
    logger.info(
      `${sourceType}: ${already.size} already stored, ${before - documents.length} skipped, ${documents.length} to ingest`,
    );
  } else if (skip > 0 || options.limit) {
    logger.info(
      `${sourceType}: ingesting ${documents.length} of ${loaded.length} documents (skip ${skip})`,
    );
  }

  if (documents.length === 0) {
    logger.info(`${sourceType}: nothing left to ingest`);
    return { sourceType, status: "ingested", count: 0 };
  }

  let inserted = 0;
  const minBatchIntervalMs = Math.ceil(
    (60_000 * INGESTION_CONFIG.embeddingBatchSize) / INGESTION_CONFIG.embeddingDocsPerMinute,
  );

  for (let start = 0; start < documents.length; start += INGESTION_CONFIG.embeddingBatchSize) {
    const startedAt = Date.now();
    const batch = documents.slice(start, start + INGESTION_CONFIG.embeddingBatchSize);
    const embeddings = await embedBatchWaitingOutRateLimits(
      batch.map((document) => document.content),
      sourceType,
    );

    await upsertChunks(
      batch.map((document, index) => ({
        sourceType: document.sourceType,
        content: document.content,
        citation: document.citation,
        metadata: document.metadata,
        embedding: embeddings[index] as number[],
      })),
    );

    inserted += batch.length;
    logger.info(`${sourceType}: embedded ${inserted}/${documents.length}`);

    const remaining = minBatchIntervalMs - (Date.now() - startedAt);
    if (remaining > 0 && start + INGESTION_CONFIG.embeddingBatchSize < documents.length) {
      await delay(remaining);
    }
  }

  return { sourceType, status: "ingested", count: inserted };
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
