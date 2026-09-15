import { SELF_LEARNING_CONFIG } from "@/config/site";
import { bumpCounters, listMemory } from "@/lib/learning/memory";

export type ModelOutcome = "answered" | "rejected";

interface ModelCounters {
  answered?: number;
  rejected?: number;
}

let reliability = new Map<string, ModelCounters>();
let refreshedAt = 0;
let refreshing: Promise<void> | null = null;

export function recordModelOutcome(modelId: string, outcome: ModelOutcome): void {
  if (outcome === "answered") {
    reliability.set(modelId, {
      ...reliability.get(modelId),
      answered: (reliability.get(modelId)?.answered ?? 0) + 1,
    });
  } else {
    reliability.set(modelId, {
      ...reliability.get(modelId),
      rejected: (reliability.get(modelId)?.rejected ?? 0) + 1,
    });
  }
  void bumpCounters("model", modelId, { [outcome]: 1 });
}

async function refresh(): Promise<void> {
  const rows = await listMemory<ModelCounters>("model");
  if (rows.length === 0) return;
  reliability = new Map(rows.map((row) => [row.topic ?? "", row.value]));
  refreshedAt = Date.now();
}

export function refreshModelStats(now = Date.now()): Promise<void> {
  if (now - refreshedAt < SELF_LEARNING_CONFIG.modelStatsRefreshMs) return Promise.resolve();
  refreshing ??= refresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export function successRatio(counters: ModelCounters | undefined): number | null {
  const answered = counters?.answered ?? 0;
  const rejected = counters?.rejected ?? 0;
  if (answered + rejected < SELF_LEARNING_CONFIG.modelMinAttempts) return null;
  return answered / (answered + rejected);
}

export function preferReliable<T extends { modelId: string }>(
  chain: readonly T[],
  stats: ReadonlyMap<string, ModelCounters> = reliability,
): T[] {
  const unreliable = (entry: T) => {
    const ratio = successRatio(stats.get(entry.modelId));
    return ratio !== null && ratio < SELF_LEARNING_CONFIG.modelDemoteBelowSuccess;
  };
  return [...chain.filter((entry) => !unreliable(entry)), ...chain.filter(unreliable)];
}

export function modelStatsSnapshot(): Record<string, ModelCounters> {
  return Object.fromEntries(reliability);
}
