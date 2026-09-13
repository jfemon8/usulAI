import { generateText } from "ai";
import { AUXILIARY_CONFIG } from "@/config/site";
import { getModelChain } from "@/lib/ai/providers";
import { logger } from "@/lib/utils/logger";

interface AuxiliaryPrompt {
  system: string;
  prompt: string;
}

export async function generateWithChain(
  purpose: string,
  options: AuxiliaryPrompt,
): Promise<string | null> {
  return (await generateWithChainFrom(purpose, options, 0))?.text ?? null;
}

export async function generateWithChainFrom(
  purpose: string,
  options: AuxiliaryPrompt,
  from: number,
): Promise<{ text: string; attempt: number } | null> {
  const chain = getModelChain();
  let lastError: unknown;

  for (const [attempt, { tier, provider, modelId, model }] of chain.entries()) {
    if (attempt < from) continue;

    try {
      const { text } = await generateText({
        model,
        system: options.system,
        prompt: options.prompt,
        temperature: AUXILIARY_CONFIG.temperature,
        maxOutputTokens: AUXILIARY_CONFIG.maxOutputTokens,
        maxRetries: 0,
      });

      if (text.trim().length > 0) return { text, attempt };
      lastError = new Error(`${provider}/${modelId} returned empty text`);
    } catch (error) {
      lastError = error;
      logger.warn(`${purpose}: tier "${tier}" failed, trying next`, {
        provider,
        modelId,
        error: String(error).slice(0, 120),
      });
    }
  }

  logger.warn(`${purpose}: every model tier failed`, {
    error: String(lastError).slice(0, 160),
  });
  return null;
}
