import { describe, expect, it } from "vitest";
import { MODEL_CHAIN, MODEL_CONFIG } from "@/config/site";

describe("MODEL_CHAIN", () => {
  it("falls back Gemini -> Groq -> OpenRouter -> Z.ai in that order", () => {
    expect(MODEL_CHAIN).toEqual(["primary", "secondary", "fallback", "reserve"]);
    expect(MODEL_CHAIN.map((tier) => MODEL_CONFIG[tier].provider)).toEqual([
      "google",
      "groq",
      "openrouter",
      "zai",
    ]);
  });

  it("keeps every tier pointed at a non-empty model id", () => {
    for (const tier of MODEL_CHAIN) {
      expect(MODEL_CONFIG[tier].model.length).toBeGreaterThan(0);
    }
  });
});
