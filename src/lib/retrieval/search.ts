import { HYBRID_CONFIG, RETRIEVAL_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { embedText, embedTexts } from "@/lib/ai/embeddings";
import {
  attachEmbeddings,
  findUnembedded,
  similaritySearch,
  textSearch,
} from "@/lib/retrieval/vectorStore";
import { logger } from "@/lib/utils/logger";
import type { RetrievedChunk } from "@/types";
import type { SearchOptions } from "@/lib/retrieval/types";

const MIN_SIMILARITY = 0.8;

async function embedQuestion(question: string): Promise<number[] | null> {
  try {
    return await embedText(question);
  } catch (error) {
    logger.warn("Query embedding unavailable, falling back to text search only", {
      error: String(error).slice(0, 160),
    });
    return null;
  }
}

function dedupe(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    if (seen.has(chunk.id)) return false;
    seen.add(chunk.id);
    return true;
  });
}

export async function retrieveAnswerContext(
  question: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const sources = options.sources ?? SOURCE_PRIORITY;
  const maxChunks = options.maxChunks ?? RETRIEVAL_CONFIG.topKPerSource;
  const minSimilarity = options.minSimilarity ?? MIN_SIMILARITY;

  const queryEmbedding = await embedQuestion(question);
  const collected: RetrievedChunk[] = [];
  const textOnlyMatches: RetrievedChunk[] = [];

  for (const sourceType of sources) {
    if (collected.length >= maxChunks) break;

    const room = maxChunks - collected.length;
    const [vectorHits, textHits] = await Promise.all([
      queryEmbedding ? similaritySearch(queryEmbedding, sourceType, room) : Promise.resolve([]),
      textSearch(question, sourceType),
    ]);

    const confidentVector = vectorHits.filter((hit) => hit.similarity >= minSimilarity);
    const confidentText = textHits.filter((hit) => hit.similarity >= HYBRID_CONFIG.minTextScore);

    textOnlyMatches.push(...confidentText);
    collected.push(...dedupe([...confidentVector, ...confidentText]).slice(0, room));
  }

  const context = dedupe(collected).slice(0, maxChunks);

  if (options.lazyEmbed !== false) {
    void backfillEmbeddings([...context, ...textOnlyMatches]);
  }

  return context;
}

async function backfillEmbeddings(candidates: RetrievedChunk[]): Promise<void> {
  try {
    const ids = dedupe(candidates)
      .slice(0, HYBRID_CONFIG.lazyEmbedPerRequest)
      .map((chunk) => chunk.id);

    const missing = await findUnembedded(ids);
    if (missing.length === 0) return;

    const embeddings = await embedTexts(missing.map((row) => row.content));
    const updated = await attachEmbeddings(
      missing.map((row, index) => ({ id: row.id, embedding: embeddings[index] as number[] })),
    );

    logger.info(`Lazy-embedded ${updated} retrieved documents`);
  } catch (error) {
    logger.warn("Lazy embedding skipped", { error: String(error).slice(0, 160) });
  }
}
