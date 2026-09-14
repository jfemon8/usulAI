import {
  CONTEXT_CONFIG,
  HYBRID_CONFIG,
  RERANK_CONFIG,
  RETRIEVAL_CONFIG,
  SOURCE_PRIORITY,
} from "@/config/site";
import {
  cachedQueryEmbedding,
  embedText,
  embedTexts,
  embeddingsCoolingDown,
} from "@/lib/ai/embeddings";
import {
  attachEmbeddings,
  findUnembedded,
  similaritySearch,
  textSearch,
} from "@/lib/retrieval/vectorStore";
import { applyRankingSignals } from "@/lib/analytics/rankingSignals";
import { capPerSource, mergeCarriedContext, sourceCap } from "@/lib/retrieval/carryForward";
import { fuseRankings } from "@/lib/retrieval/fusion";
import { detectSourceIntent } from "@/lib/retrieval/sourceIntent";
import { rerankContext } from "@/lib/retrieval/rerank";
import { logger } from "@/lib/utils/logger";
import type { RetrievedChunk, SourceType } from "@/types";
import type { SearchOptions } from "@/lib/retrieval/types";

const embeddingsInFlight = new Set<string>();

async function embedQuestion(question: string): Promise<number[] | null> {
  const known = await cachedQueryEmbedding(question);
  if (known) return known;
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
  pool: number,
): Promise<RetrievedChunk[]> {
  const [vectorHits, textHits] = await Promise.all([
    queryEmbedding ? similaritySearch(queryEmbedding, sourceType, pool) : Promise.resolve([]),
    textSearch(question, sourceType, HYBRID_CONFIG.textCandidatesPerSource, expandSynonyms),
  ]);

  const confidentVector = vectorHits.filter((hit) => hit.similarity >= minSimilarity);

  return fuseRankings([confidentVector, textHits]);
}

export async function retrieveAnswerContext(
  question: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const sources = options.sources ?? SOURCE_PRIORITY;
  const maxChunks = options.maxChunks ?? CONTEXT_CONFIG.maxContextChunks;
  const minSimilarity = options.minSimilarity ?? RETRIEVAL_CONFIG.minVectorScore;
  const judging = options.rerank !== false && RERANK_CONFIG.enabled;
  const poolFor = (sourceType: SourceType) =>
    sourceCap(sourceType, sources) * (judging ? RERANK_CONFIG.poolFactor : 1);

  const queryEmbedding = await embedQuestion(question);

  const perSource = await Promise.all(
    sources.map((sourceType) =>
      gatherFromSource(
        sourceType,
        question,
        queryEmbedding,
        minSimilarity,
        options.expandSynonyms !== false,
        poolFor(sourceType),
      ),
    ),
  );

  const candidates: RetrievedChunk[] = [];
  const leftovers: RetrievedChunk[] = [];

  sources.forEach((sourceType, index) => {
    const hits = perSource[index] ?? [];
    const pool = poolFor(sourceType);
    candidates.push(...hits.slice(0, pool));
    leftovers.push(...hits.slice(pool));
  });

  const carried = options.carried ?? [];
  const merged = mergeCarriedContext(
    dedupe(candidates),
    carried,
    candidates.length + carried.length,
  );

  const tuned = await applyRankingSignals(question, merged);
  const relevant = judging ? await rerankContext(question, tuned) : tuned;
  const context = capPerSource(relevant, new Set(carried.map((chunk) => chunk.id)), sources).slice(
    0,
    maxChunks,
  );

  if (options.lazyEmbed !== false) {
    void backfillEmbeddings([...context, ...leftovers]);
  }

  return context;
}

export async function retrieveForQuestion(
  question: string,
  query: string,
  options: SearchOptions = {},
): Promise<{ context: RetrievedChunk[]; scopedTo: SourceType[] | null }> {
  const scopedTo = options.sources ? null : detectSourceIntent(question);

  if (scopedTo) {
    const scoped = await retrieveAnswerContext(query, { ...options, sources: scopedTo });
    if (scoped.length > 0) return { context: scoped, scopedTo };
    logger.info(
      `No evidence in ${scopedTo.join(", ")} for a scoped question, widening to all sources`,
    );
  }

  return { context: await retrieveAnswerContext(query, options), scopedTo: null };
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
      missing.map((row, index) => ({
        id: row.id,
        content: row.content,
        embedding: embeddings[index] as number[],
      })),
    );

    logger.info(`Lazy-embedded ${updated} retrieved documents`);
  } catch (error) {
    logger.warn("Lazy embedding skipped", { error: String(error).slice(0, 160) });
  } finally {
    for (const id of ids) embeddingsInFlight.delete(id);
  }
}
