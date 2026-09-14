import { HYBRID_CONFIG } from "@/config/site";
import type { RetrievedChunk } from "@/types";

export function fuseRankings(
  lists: readonly RetrievedChunk[][],
  k: number = HYBRID_CONFIG.fusionK,
  weights: readonly number[] = [],
): RetrievedChunk[] {
  const fused = new Map<string, { chunk: RetrievedChunk; score: number }>();

  lists.forEach((list, position) => {
    const weight = weights[position] ?? 1;
    list.forEach((chunk, rank) => {
      const current = fused.get(chunk.id);
      const contribution = weight / (k + rank + 1);

      if (!current) {
        fused.set(chunk.id, { chunk, score: contribution });
        return;
      }

      current.score += contribution;
      if (chunk.similarity > current.chunk.similarity) current.chunk = chunk;
    });
  });

  return [...fused.values()]
    .sort((a, b) => b.score - a.score || b.chunk.similarity - a.chunk.similarity)
    .map(({ chunk }) => chunk);
}
