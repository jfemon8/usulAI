import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { MODEL_CHAIN, MODEL_CONFIG } from "@/config/site";
import { getAiEnv, getEmbeddingEnv } from "@/lib/utils/env";

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

export function getModelChain(): TieredModel[] {
  getAiEnv();

  return MODEL_CHAIN.map((tier) => ({
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
