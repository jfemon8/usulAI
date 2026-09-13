export interface ThresholdRecommendation {
  threshold: number;
  separated: boolean;
  relevantFloor: number;
  noiseCeiling: number;
  margin: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[index] as number;
}

export function recommendThreshold(
  relevantScores: number[],
  noiseTopScores: number[],
): ThresholdRecommendation {
  const relevant = [...relevantScores].sort((a, b) => a - b);
  const noise = [...noiseTopScores].sort((a, b) => a - b);

  const relevantFloor = relevant[0] ?? Number.NaN;
  const noiseCeiling = noise.at(-1) ?? Number.NaN;
  const separated = relevantFloor > noiseCeiling;
  const threshold = separated ? (relevantFloor + noiseCeiling) / 2 : percentile(relevant, 0.1);

  return {
    threshold: Number(threshold.toFixed(3)),
    separated,
    relevantFloor,
    noiseCeiling,
    margin: Number((relevantFloor - noiseCeiling).toFixed(3)),
  };
}
