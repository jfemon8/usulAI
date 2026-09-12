import { generateText } from "ai";
import { getModelChain } from "@/lib/ai/providers";
import { logger } from "@/lib/utils/logger";

export async function generateWithChain(
  purpose: string,
  options: { system: string; prompt: string },
): Promise<string | null> {
  const chain = getModelChain();
  let lastError: unknown;

  for (const { tier, provider, modelId, model } of chain) {
    try {
      const { text } = await generateText({
        model,
        system: options.system,
        prompt: options.prompt,
        maxRetries: 0,
      });

      if (text.trim().length > 0) return text;
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
