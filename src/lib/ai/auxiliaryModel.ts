import { generateText } from "ai";
import { AUXILIARY_CONFIG } from "@/config/site";
import { healthyFirst, recordModelFailure, recordModelSuccess } from "@/lib/ai/modelHealth";
import { getModelChain } from "@/lib/ai/providers";
import { logger } from "@/lib/utils/logger";

export interface AuxiliaryPrompt {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function generateWithChain(
  purpose: string,
  options: AuxiliaryPrompt,
): Promise<string | null> {
  return (await generateWithChainFrom(purpose, options, 0))?.text ?? null;
}

export async function generateWithPreferredModels(
  purpose: string,
  options: AuxiliaryPrompt,
  preferred: readonly string[],
  onlyPreferred = false,
): Promise<{ text: string; modelId: string } | null> {
  const chain = getModelChain().filter(
    (entry) => !onlyPreferred || preferred.includes(entry.modelId),
  );
  const rank = (modelId: string) => {
    const index = preferred.indexOf(modelId);
    return index < 0 ? preferred.length : index;
  };
  const ordered = healthyFirst([...chain].sort((a, b) => rank(a.modelId) - rank(b.modelId)));

  for (const { tier, provider, modelId, model } of ordered) {
    try {
      const { text } = await generateText({
        model,
        system: options.system,
        prompt: options.prompt,
        temperature: AUXILIARY_CONFIG.temperature,
        maxOutputTokens: options.maxOutputTokens ?? AUXILIARY_CONFIG.maxOutputTokens,
        maxRetries: 0,
        ...(options.timeoutMs ? { abortSignal: AbortSignal.timeout(options.timeoutMs) } : {}),
        ...(options.headers ? { headers: options.headers } : {}),
      });
      if (text.trim().length > 0) {
        recordModelSuccess(modelId);
        return { text, modelId };
      }
    } catch (error) {
      recordModelFailure(modelId, error);
      logger.warn(`${purpose}: tier "${tier}" failed, trying next`, {
        provider,
        modelId,
        error: String(error).slice(0, 120),
      });
    }
  }

  return null;
}

export async function generateWithChainFrom(
  purpose: string,
  options: AuxiliaryPrompt,
  from: number,
): Promise<{ text: string; attempt: number } | null> {
  const chain = healthyFirst(getModelChain());
  let lastError: unknown;

  for (const [attempt, { tier, provider, modelId, model }] of chain.entries()) {
    if (attempt < from) continue;
    if (options.signal?.aborted) {
      lastError = new Error("time budget spent");
      break;
    }

    try {
      const { text } = await generateText({
        model,
        system: options.system,
        prompt: options.prompt,
        temperature: AUXILIARY_CONFIG.temperature,
        maxOutputTokens: options.maxOutputTokens ?? AUXILIARY_CONFIG.maxOutputTokens,
        maxRetries: 0,
        ...(options.signal ? { abortSignal: options.signal } : {}),
      });

      if (text.trim().length > 0) {
        recordModelSuccess(modelId);
        return { text, attempt };
      }
      lastError = new Error(`${provider}/${modelId} returned empty text`);
    } catch (error) {
      lastError = error;
      recordModelFailure(modelId, error);
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
