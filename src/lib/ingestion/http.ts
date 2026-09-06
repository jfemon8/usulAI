import { INGESTION_CONFIG } from "@/config/site";
import { logger } from "@/lib/utils/logger";

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? INGESTION_CONFIG.requestTimeoutMs;
  const retries = options.retries ?? INGESTION_CONFIG.requestRetries;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoff = INGESTION_CONFIG.retryBaseDelayMs * 2 ** (attempt - 1);
      logger.warn(`Retrying ${url}`, { attempt, backoff });
      await delay(backoff);
    }

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", ...options.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export async function mapWithConcurrency<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results = new Array<TOut>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as TIn, index);
    }
  });

  await Promise.all(runners);
  return results;
}
