import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MODEL_CHAIN, MODEL_CONFIG, ZAI_CONFIG } from "@/config/site";

const KEYS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "ZAI_API_KEY",
] as const;

const saved: Record<string, string | undefined> = {};

async function loadChain() {
  const { getModelChain } = await import("@/lib/ai/providers");
  return getModelChain();
}

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    process.env[key] = "test-key";
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("getModelChain", () => {
  it("offers one attempt per configured model, Z.ai contributing all of its models", async () => {
    const chain = await loadChain();

    expect(chain).toHaveLength(MODEL_CHAIN.length - 1 + ZAI_CONFIG.models.length);
    expect(chain.map((entry) => entry.modelId)).toEqual([
      MODEL_CONFIG.primary.model,
      MODEL_CONFIG.secondary.model,
      MODEL_CONFIG.fallback.model,
      ...ZAI_CONFIG.models,
    ]);
  });

  it("keeps the tiers in priority order so the fastest healthy one answers first", async () => {
    const chain = await loadChain();

    expect(chain.map((entry) => entry.tier)).toEqual([
      "primary",
      "secondary",
      "fallback",
      ...ZAI_CONFIG.models.map(() => "reserve"),
    ]);
  });

  it("drops a tier whose key is missing without dropping the rest", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GROQ_API_KEY;

    const chain = await loadChain();

    expect(chain.map((entry) => entry.tier)).toEqual([
      "fallback",
      ...ZAI_CONFIG.models.map(() => "reserve"),
    ]);
  });

  it("still offers every Z.ai model when it is the only configured tier", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const chain = await loadChain();

    expect(chain).toHaveLength(ZAI_CONFIG.models.length);
    expect(chain.every((entry) => entry.tier === "reserve")).toBe(true);
  });

  it("throws only when no tier at all is configured", async () => {
    for (const key of KEYS) delete process.env[key];

    await expect(loadChain()).rejects.toThrow(/No model tier is configured/);
  });

  it("never repeats a model, so no attempt is wasted on a known failure", async () => {
    const chain = await loadChain();
    const ids = chain.map((entry) => `${entry.provider}/${entry.modelId}`);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
