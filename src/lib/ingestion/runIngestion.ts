import { INGESTION_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { embedTexts } from "@/lib/ai/embeddings";
import { fetchQuranCorpus } from "@/lib/ingestion/sources/quran";
import { fetchHadithCorpus } from "@/lib/ingestion/sources/hadith";
import { loadIjmaDocuments } from "@/lib/ingestion/sources/ijma";
import { loadQiyasDocuments } from "@/lib/ingestion/sources/qiyas";
import { loadSiratDocuments } from "@/lib/ingestion/sources/sirat";
import { deleteSourceChunks, upsertChunks } from "@/lib/retrieval/vectorStore";
import { logger } from "@/lib/utils/logger";
import type { IngestionDocument, SourceType } from "@/types";

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
  const documents = await SOURCE_LOADERS[sourceType]();

  if (documents.length === 0) {
    logger.warn(`No documents found for ${sourceType}`);
    return { sourceType, status: "empty", count: 0 };
  }

  if (options.replace) {
    const removed = await deleteSourceChunks(sourceType);
    logger.info(`Removed ${removed} existing ${sourceType} chunks before re-ingest`);
  }

  let inserted = 0;

  for (let start = 0; start < documents.length; start += INGESTION_CONFIG.embeddingBatchSize) {
    const batch = documents.slice(start, start + INGESTION_CONFIG.embeddingBatchSize);
    const embeddings = await embedTexts(batch.map((document) => document.content));

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
