import { SOURCE_PRIORITY, RETRIEVAL_CONFIG } from "@/config/site";
import { embedText } from "@/lib/ai/embeddings";
import { similaritySearch } from "@/lib/retrieval/vectorStore";
import type { RetrievedChunk } from "@/types";
import type { SearchOptions } from "@/lib/retrieval/types";

const MIN_SIMILARITY = 0.75;

export async function retrieveAnswerContext(
  question: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const sources = options.sources ?? SOURCE_PRIORITY;
  const maxChunks = options.maxChunks ?? RETRIEVAL_CONFIG.topKPerSource;
  const minSimilarity = options.minSimilarity ?? MIN_SIMILARITY;

  const queryEmbedding = await embedText(question);
  const collected: RetrievedChunk[] = [];

  for (const sourceType of sources) {
    if (collected.length >= maxChunks) break;

    const matches = await similaritySearch(
      queryEmbedding,
      sourceType,
      maxChunks - collected.length,
    );

    collected.push(...matches.filter((match) => match.similarity >= minSimilarity));
  }

  return collected;
}
