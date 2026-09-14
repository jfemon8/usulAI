import { MODEL_HEALTH_CONFIG } from "@/config/site";
import { logger } from "@/lib/utils/logger";

export type ModelFailureKind = "auth" | "quota" | "rate" | "overload" | "other";

const PATTERNS: [ModelFailureKind, RegExp][] = [
  ["auth", /permission_denied|denied access|unauthori[sz]ed|invalid api key|\b401\b|\b403\b/i],
  ["quota", /per[- ]day|daily|tokens per day|\bTPD\b|insufficient balance|\b1113\b|quota|credits/i],
  ["rate", /rate limit|too many requests|\b429\b/i],
  ["overload", /overload|temporarily|\b503\b|\b529\b|unavailable/i],
];

const COOLDOWNS: Record<ModelFailureKind, number> = {
  auth: MODEL_HEALTH_CONFIG.authCooldownMs,
  quota: MODEL_HEALTH_CONFIG.quotaCooldownMs,
  rate: MODEL_HEALTH_CONFIG.rateCooldownMs,
  overload: MODEL_HEALTH_CONFIG.overloadCooldownMs,
  other: 0,
};

const coolingUntil = new Map<string, number>();
const coolingKind = new Map<string, ModelFailureKind>();
const TRANSIENT: readonly ModelFailureKind[] = ["rate", "overload"];

export function classifyModelError(error: unknown): ModelFailureKind {
  const text = String(error);
  return PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

export function recordModelFailure(modelId: string, error: unknown, now = Date.now()): void {
  const kind = classifyModelError(error);
  const cooldown = COOLDOWNS[kind];
  if (cooldown <= 0) return;

  const until = now + cooldown;
  if ((coolingUntil.get(modelId) ?? 0) < until) {
    coolingUntil.set(modelId, until);
    coolingKind.set(modelId, kind);
    logger.info(`Model ${modelId} cooling down after a ${kind} failure`, {
      seconds: Math.round(cooldown / 1000),
    });
  }
}

export function recordModelSuccess(modelId: string): void {
  coolingUntil.delete(modelId);
  coolingKind.delete(modelId);
}

export function isTransientFailure(error: unknown): boolean {
  return TRANSIENT.includes(classifyModelError(error));
}

export function isModelCoolingDown(modelId: string, now = Date.now()): boolean {
  return (coolingUntil.get(modelId) ?? 0) > now;
}

export function healthyFirst<T extends { modelId: string }>(
  chain: readonly T[],
  now = Date.now(),
): T[] {
  const healthy = chain.filter((entry) => !isModelCoolingDown(entry.modelId, now));
  if (healthy.length > 0) return healthy;

  const soonest = [...chain].sort(
    (left, right) => (coolingUntil.get(left.modelId) ?? 0) - (coolingUntil.get(right.modelId) ?? 0),
  )[0];
  return soonest ? [soonest] : [];
}

export function answerOrder<T extends { modelId: string }>(
  chain: readonly T[],
  now = Date.now(),
): T[] {
  const cooling = (entry: T) => isModelCoolingDown(entry.modelId, now);
  const recovery = (left: T, right: T) =>
    (coolingUntil.get(left.modelId) ?? 0) - (coolingUntil.get(right.modelId) ?? 0);

  const healthy = chain.filter((entry) => !cooling(entry));
  const transient = chain
    .filter(
      (entry) => cooling(entry) && TRANSIENT.includes(coolingKind.get(entry.modelId) ?? "other"),
    )
    .sort(recovery);
  if (healthy.length + transient.length > 0) return [...healthy, ...transient];

  return healthyFirst(chain, now);
}

export function resetModelHealth(): void {
  coolingUntil.clear();
  coolingKind.clear();
}
