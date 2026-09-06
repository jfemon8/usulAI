import { embed, embedMany } from "ai";
import { getEmbeddingModel } from "@/lib/ai/providers";

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: text,
  });

  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { embeddings } = await embedMany({
    model: getEmbeddingModel(),
    values: texts,
  });

  return embeddings;
}
