import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { MODEL_CHAIN, MODEL_CONFIG, OPENROUTER_FALLBACK_MODELS, ZAI_CONFIG } from "@/config/site";
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

export function getFallbackModel(): LanguageModel {
  return openrouter(MODEL_CONFIG.fallback.model, {
    extraBody: { models: [MODEL_CONFIG.fallback.model, ...OPENROUTER_FALLBACK_MODELS] },
  });
}

const zaiFetch: typeof fetch = async (input, init) => {
  if (typeof init?.body !== "string") return fetch(input, init);

  const body = JSON.parse(init.body) as Record<string, unknown>;
  body.thinking = { type: ZAI_CONFIG.thinking };

  return fetch(input, { ...init, body: JSON.stringify(body) });
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
  fallback: () => [{ modelId: MODEL_CONFIG.fallback.model, model: getFallbackModel() }],
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
