import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { MODEL_CHAIN, MODEL_CONFIG } from "@/config/site";
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
  return openrouter(MODEL_CONFIG.fallback.model);
}

const TIER_FACTORIES: Record<ModelTier, () => LanguageModel> = {
  primary: getPrimaryModel,
  secondary: getSecondaryModel,
  fallback: getFallbackModel,
};

const TIER_KEYS: Record<ModelTier, string> = {
  primary: "GOOGLE_GENERATIVE_AI_API_KEY",
  secondary: "GROQ_API_KEY",
  fallback: "OPENROUTER_API_KEY",
};

export function getModelChain(): TieredModel[] {
  const configured = MODEL_CHAIN.filter((tier) => Boolean(process.env[TIER_KEYS[tier]]));

  if (configured.length === 0) {
    throw new Error(
      `No model tier is configured. Set at least one of: ${Object.values(TIER_KEYS).join(", ")}`,
    );
  }

  return configured.map((tier) => ({
    tier,
    provider: MODEL_CONFIG[tier].provider,
    modelId: MODEL_CONFIG[tier].model,
    model: TIER_FACTORIES[tier](),
  }));
}

export function getEmbeddingModel() {
  getEmbeddingEnv();
  return google.textEmbeddingModel(MODEL_CONFIG.embedding.model);
}
