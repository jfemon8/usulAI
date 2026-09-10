import { DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { logger } from "@/lib/utils/logger";
import type { QuestionLanguage } from "@/lib/ai/language";
import type { RetrievedChunk, SourceType } from "@/types";

export interface QueryLogEntry {
  question: string;
  language: QuestionLanguage;
  createdAt: Date;
  sourcesUsed: SourceType[];
  retrievedCount: number;
  topScore: number | null;
  vectorHits: number;
  textHits: number;
  references: string[];
  answered: boolean;
  modelTier?: string;
  errorTier?: string;
}

export async function logQuery(entry: Omit<QueryLogEntry, "createdAt">): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<QueryLogEntry>(DB_CONFIG.queryLogCollection)
      .insertOne({ ...entry, createdAt: new Date() });
  } catch (error) {
    logger.warn("Query log write failed", { error: String(error).slice(0, 160) });
  }
}

export function summariseRetrieval(context: RetrievedChunk[]) {
  return {
    sourcesUsed: [...new Set(context.map((chunk) => chunk.sourceType))],
    retrievedCount: context.length,
    topScore: context.length > 0 ? Math.max(...context.map((chunk) => chunk.similarity)) : null,
    vectorHits: context.filter((chunk) => chunk.retrievedBy === "vector").length,
    textHits: context.filter((chunk) => chunk.retrievedBy === "text").length,
    references: context.map((chunk) => chunk.citation.reference),
  };
}
