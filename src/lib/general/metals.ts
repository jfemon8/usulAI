import { GENERAL_ASSISTANT_CONFIG } from "@/config/site";
import { logger } from "@/lib/utils/logger";
import type { ZakatPrices } from "@/types";

const TROY_OUNCE_GRAMS = 31.1034768;

let cached: { prices: ZakatPrices; at: number } | null = null;

async function json(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(GENERAL_ASSISTANT_CONFIG.requestTimeoutMs),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} answered ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

function priceOf(body: Record<string, unknown>): number | null {
  const value = body.price;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export const NO_PRICES: ZakatPrices = {
  goldPerGram: null,
  silverPerGram: null,
  source: null,
  updatedAt: null,
};

export async function fetchMetalPrices(): Promise<ZakatPrices> {
  if (cached && Date.now() - cached.at < GENERAL_ASSISTANT_CONFIG.metalCacheMs)
    return cached.prices;
  const { endpoints } = GENERAL_ASSISTANT_CONFIG;

  try {
    const [gold, silver, exchange] = await Promise.all([
      json(endpoints.gold),
      json(endpoints.silver),
      json(endpoints.exchange),
    ]);
    const rates = exchange.rates as Record<string, unknown> | undefined;
    const taka = typeof rates?.BDT === "number" ? rates.BDT : null;
    const goldOunce = priceOf(gold);
    const silverOunce = priceOf(silver);
    if (taka === null || goldOunce === null || silverOunce === null) {
      throw new Error("metal or exchange price missing");
    }

    const prices: ZakatPrices = {
      goldPerGram: (goldOunce / TROY_OUNCE_GRAMS) * taka,
      silverPerGram: (silverOunce / TROY_OUNCE_GRAMS) * taka,
      source: "gold-api.com, open.er-api.com",
      updatedAt: typeof gold.updatedAt === "string" ? gold.updatedAt : new Date().toISOString(),
    };
    cached = { prices, at: Date.now() };
    return prices;
  } catch (error) {
    logger.warn("Metal price lookup failed", { error: String(error).slice(0, 160) });
    return cached?.prices ?? NO_PRICES;
  }
}
