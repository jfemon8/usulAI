import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { MODEL_CHAIN, MODEL_CONFIG, OPENROUTER_FALLBACK_MODELS, ZAI_CONFIG } from "@/config/site";
import { createSlotGate, releaseWhenConsumed, SLOT_LEVEL, type SlotGate } from "@/lib/ai/slotGate";
import { getEmbeddingEnv } from "@/lib/utils/env";

export type ModelTier = (typeof MODEL_CHAIN)[number];

export interface TieredModel {
  tier: ModelTier;
  provider: string;
  modelId: string;
  model: LanguageModel;
}

export function getPrimaryModel(): LanguageModel {
  return google(MODEL_CONFIG.primary.model);
}

export function getSecondaryModel(): LanguageModel {
  return groq(MODEL_CONFIG.secondary.model);
}

export function getFallbackModels(): { modelId: string; model: LanguageModel }[] {
  return [MODEL_CONFIG.fallback.model, ...OPENROUTER_FALLBACK_MODELS].map((modelId) => ({
    modelId,
    model: openrouter(modelId),
  }));
}

export const PRIORITY_HEADER = "x-usul-priority";
export const ANSWER_PRIORITY_HEADERS: Record<string, string> = { [PRIORITY_HEADER]: "answer" };
export const BACKGROUND_PRIORITY_HEADERS: Record<string, string> = {
  [PRIORITY_HEADER]: "background",
};

const zaiGates = new Map<string, SlotGate>();

function zaiGate(modelId: string): SlotGate {
  const existing = zaiGates.get(modelId);
  if (existing) return existing;
  const gate = createSlotGate(ZAI_CONFIG.maxConcurrentPerModel, ZAI_CONFIG.reservedForAnswers);
  zaiGates.set(modelId, gate);
  return gate;
}

function requestHeaders(headers: HeadersInit | undefined): Headers {
  if (!headers || headers instanceof Headers || Array.isArray(headers)) return new Headers(headers);
  return new Headers(
    Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

const zaiFetch: typeof fetch = async (input, init) => {
  if (typeof init?.body !== "string") return fetch(input, init);

  const body = JSON.parse(init.body) as Record<string, unknown>;
  body.thinking = { type: ZAI_CONFIG.thinking };

  const headers = requestHeaders(init.headers);
  const level = headers.get(PRIORITY_HEADER);
  headers.delete(PRIORITY_HEADER);

  const slotLevel =
    level === "answer"
      ? SLOT_LEVEL.answer
      : level === "background"
        ? SLOT_LEVEL.background
        : SLOT_LEVEL.interactive;
  const release = await zaiGate(String(body.model)).acquire(
    slotLevel,
    init.signal,
    slotLevel === SLOT_LEVEL.interactive ? ZAI_CONFIG.auxiliaryWaitMs : undefined,
  );
  const timer = setTimeout(release, ZAI_CONFIG.slotMaxHoldMs);
  const done = () => {
    clearTimeout(timer);
    release();
  };
  const abandoned = () => {
    clearTimeout(timer);
    setTimeout(release, ZAI_CONFIG.abandonedHoldMs);
  };
  init.signal?.addEventListener("abort", abandoned, { once: true });

  try {
    const response = await fetch(input, { ...init, headers, body: JSON.stringify(body) });
    return releaseWhenConsumed(response, done, abandoned);
  } catch (error) {
    if (init.signal?.aborted) abandoned();
    else done();
    throw error;
  }
};

export function getReserveModels(): { modelId: string; model: LanguageModel }[] {
  const zai = createOpenAICompatible({
    name: MODEL_CONFIG.reserve.provider,
    baseURL: ZAI_CONFIG.baseUrl,
    apiKey: process.env.ZAI_API_KEY,
    fetch: zaiFetch,
  });

  return ZAI_CONFIG.models.map((modelId) => ({ modelId, model: zai(modelId) }));
}

const TIER_FACTORIES: Record<ModelTier, () => { modelId: string; model: LanguageModel }[]> = {
  primary: () => [{ modelId: MODEL_CONFIG.primary.model, model: getPrimaryModel() }],
  secondary: () => [{ modelId: MODEL_CONFIG.secondary.model, model: getSecondaryModel() }],
  fallback: getFallbackModels,
  reserve: getReserveModels,
};

const TIER_KEYS: Record<ModelTier, string> = {
  primary: "GOOGLE_GENERATIVE_AI_API_KEY",
  secondary: "GROQ_API_KEY",
  fallback: "OPENROUTER_API_KEY",
  reserve: "ZAI_API_KEY",
};

export function getModelChain(): TieredModel[] {
  const configured = MODEL_CHAIN.filter((tier) => Boolean(process.env[TIER_KEYS[tier]]));

  if (configured.length === 0) {
    throw new Error(
      `No model tier is configured. Set at least one of: ${Object.values(TIER_KEYS).join(", ")}`,
    );
  }

  return configured.flatMap((tier) =>
    TIER_FACTORIES[tier]().map(({ modelId, model }) => ({
      tier,
      provider: MODEL_CONFIG[tier].provider,
      modelId,
      model,
    })),
  );
}

export function getEmbeddingModel() {
  getEmbeddingEnv();
  return google.textEmbeddingModel(MODEL_CONFIG.embedding.model);
}
