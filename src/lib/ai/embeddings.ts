import { embed, embedMany } from "ai";
import { EMBEDDING_TASK, INGESTION_CONFIG, RETRIEVAL_CONFIG } from "@/config/site";
import { getEmbeddingModel } from "@/lib/ai/providers";

function providerOptions(taskType: string) {
  return {
    google: {
      outputDimensionality: RETRIEVAL_CONFIG.embeddingDimensions,
      taskType,
    },
  };
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: text,
    providerOptions: providerOptions(EMBEDDING_TASK.query),
  });

  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { embeddings } = await embedMany({
    model: getEmbeddingModel(),
    values: texts,
    providerOptions: providerOptions(EMBEDDING_TASK.document),
    maxParallelCalls: 1,
    maxRetries: INGESTION_CONFIG.embeddingMaxRetries,
  });

  return embeddings;
}
