import { embed, embedMany } from "ai";
import {
  EMBEDDING_RUNTIME_CONFIG,
  EMBEDDING_TASK,
  INGESTION_CONFIG,
  RETRIEVAL_CONFIG,
} from "@/config/site";
import { getEmbeddingModel } from "@/lib/ai/providers";
import { createLru, normalizeCacheKey } from "@/lib/utils/lru";

function providerOptions(taskType: string) {
  return {
    google: {
      outputDimensionality: RETRIEVAL_CONFIG.embeddingDimensions,
      taskType,
    },
  };
}

const queryCache = createLru<number[]>(EMBEDDING_RUNTIME_CONFIG.queryCacheSize);
let cooldownUntil = 0;

function isProviderRejection(error: unknown): boolean {
  return /permission_denied|api[_ ]?key|unauthorized|forbidden|\b401\b|\b403\b/i.test(
    String(error),
  );
}

export function embeddingsCoolingDown(): boolean {
  return Date.now() < cooldownUntil;
}

export function queryCacheStats(): { size: number; hits: number } {
  return queryCache.stats();
}

export async function embedText(text: string): Promise<number[]> {
  const key = normalizeCacheKey(text);
  const cached = queryCache.get(key);
  if (cached) return cached;

  try {
    const { embedding } = await embed({
      model: getEmbeddingModel(),
      value: text,
      providerOptions: providerOptions(EMBEDDING_TASK.query),
    });

    queryCache.set(key, embedding);
    return embedding;
  } catch (error) {
    if (isProviderRejection(error)) {
      cooldownUntil = Date.now() + EMBEDDING_RUNTIME_CONFIG.providerCooldownMs;
    }
    throw error;
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    const { embeddings } = await embedMany({
      model: getEmbeddingModel(),
      values: texts,
      providerOptions: providerOptions(EMBEDDING_TASK.document),
      maxParallelCalls: 1,
      maxRetries: INGESTION_CONFIG.embeddingMaxRetries,
    });

    return embeddings;
  } catch (error) {
    if (isProviderRejection(error)) {
      cooldownUntil = Date.now() + EMBEDDING_RUNTIME_CONFIG.providerCooldownMs;
    }
    throw error;
  }
}
