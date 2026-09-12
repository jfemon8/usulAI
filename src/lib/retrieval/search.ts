import { CONTEXT_CONFIG, HYBRID_CONFIG, RERANK_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { embedText, embedTexts, embeddingsCoolingDown } from "@/lib/ai/embeddings";
import {
  attachEmbeddings,
  findUnembedded,
  similaritySearch,
  textSearch,
} from "@/lib/retrieval/vectorStore";
import { applyRankingSignals } from "@/lib/analytics/rankingSignals";
import { rerankContext } from "@/lib/retrieval/rerank";
import { logger } from "@/lib/utils/logger";
import type { RetrievedChunk, SourceType } from "@/types";
import type { SearchOptions } from "@/lib/retrieval/types";

const MIN_SIMILARITY = 0.8;
const embeddingsInFlight = new Set<string>();

async function embedQuestion(question: string): Promise<number[] | null> {
  if (embeddingsCoolingDown()) return null;

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

async function gatherFromSource(
  sourceType: SourceType,
  question: string,
  queryEmbedding: number[] | null,
  minSimilarity: number,
  expandSynonyms: boolean,
): Promise<RetrievedChunk[]> {
  const cap = CONTEXT_CONFIG.perSourceCap[sourceType];

  const [vectorHits, textHits] = await Promise.all([
    queryEmbedding ? similaritySearch(queryEmbedding, sourceType, cap) : Promise.resolve([]),
    textSearch(question, sourceType, HYBRID_CONFIG.textCandidatesPerSource, expandSynonyms),
  ]);

  const confidentVector = vectorHits.filter((hit) => hit.similarity >= minSimilarity);
  const confidentText = textHits.filter((hit) => hit.similarity >= HYBRID_CONFIG.minTextScore);

  return dedupe([...confidentVector, ...confidentText]);
}

export async function retrieveAnswerContext(
  question: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const sources = options.sources ?? SOURCE_PRIORITY;
  const maxChunks = options.maxChunks ?? CONTEXT_CONFIG.maxContextChunks;
  const minSimilarity = options.minSimilarity ?? MIN_SIMILARITY;

  const queryEmbedding = await embedQuestion(question);

  const perSource = await Promise.all(
    sources.map((sourceType) =>
      gatherFromSource(
        sourceType,
        question,
        queryEmbedding,
        minSimilarity,
        options.expandSynonyms !== false,
      ),
    ),
  );

  const context: RetrievedChunk[] = [];
  const leftovers: RetrievedChunk[] = [];

  sources.forEach((sourceType, index) => {
    const hits = perSource[index] ?? [];
    const cap = CONTEXT_CONFIG.perSourceCap[sourceType];
    context.push(...hits.slice(0, cap));
    leftovers.push(...hits.slice(cap));
  });

  const ordered = dedupe(context)
    .sort((a, b) => sources.indexOf(a.sourceType) - sources.indexOf(b.sourceType))
    .slice(0, maxChunks);

  if (options.lazyEmbed !== false) {
    void backfillEmbeddings([...ordered, ...leftovers]);
  }

  const tuned = await applyRankingSignals(question, ordered);

  if (options.rerank === false || !RERANK_CONFIG.enabled) return tuned;

  const relevant = await rerankContext(question, tuned);
  return relevant.sort((a, b) => sources.indexOf(a.sourceType) - sources.indexOf(b.sourceType));
}

async function backfillEmbeddings(candidates: RetrievedChunk[]): Promise<void> {
  if (embeddingsCoolingDown()) return;

  const ids = dedupe(candidates)
    .map((chunk) => chunk.id)
    .filter((id) => !embeddingsInFlight.has(id))
    .slice(0, HYBRID_CONFIG.lazyEmbedPerRequest);

  if (ids.length === 0) return;
  for (const id of ids) embeddingsInFlight.add(id);

  try {
    const missing = await findUnembedded(ids);
    if (missing.length === 0) return;

    const embeddings = await embedTexts(missing.map((row) => row.content));
    const updated = await attachEmbeddings(
      missing.map((row, index) => ({ id: row.id, embedding: embeddings[index] as number[] })),
    );

    logger.info(`Lazy-embedded ${updated} retrieved documents`);
  } catch (error) {
    logger.warn("Lazy embedding skipped", { error: String(error).slice(0, 160) });
  } finally {
    for (const id of ids) embeddingsInFlight.delete(id);
  }
}
