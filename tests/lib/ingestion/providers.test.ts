import { describe, expect, it, vi } from "vitest";
import { HADITH_BOOKS } from "@/config/site";
import { HADITH_PROVIDERS } from "@/lib/ingestion/sources/hadith";
import { QURAN_PROVIDERS } from "@/lib/ingestion/sources/quran";
import { runProviderChain } from "@/lib/ingestion/sources/providers/runProviderChain";
import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";
import type { IngestionDocument } from "@/types";

function stubProvider(
  name: string,
  behaviour: "ok" | "throws" | "empty" | "unconfigured",
): CorpusProvider {
  return {
    name,
    requiresKey: false,
    isConfigured: () => behaviour !== "unconfigured",
    fetchAll: async () => {
      if (behaviour === "throws") throw new Error(`${name} exploded`);
      if (behaviour === "empty") return [];
      return [
        {
          sourceType: "quran",
          content: name,
          citation: { sourceType: "quran", reference: name },
        },
      ] satisfies IngestionDocument[];
    },
  };
}

describe("runProviderChain", () => {
  it("returns the first provider that yields documents", async () => {
    const documents = await runProviderChain("quran", [
      stubProvider("first", "ok"),
      stubProvider("second", "ok"),
    ]);

    expect(documents[0]?.content).toBe("first");
  });

  it("falls through failures, empty results, and unconfigured providers", async () => {
    const documents = await runProviderChain("quran", [
      stubProvider("no-key", "unconfigured"),
      stubProvider("broken", "throws"),
      stubProvider("empty", "empty"),
      stubProvider("working", "ok"),
    ]);

    expect(documents[0]?.content).toBe("working");
  });

  it("throws with every provider error once the chain is exhausted", async () => {
    await expect(
      runProviderChain("hadith", [stubProvider("a", "throws"), stubProvider("b", "throws")]),
    ).rejects.toThrow(/a exploded[\s\S]*b exploded/);
  });

  it("skips a provider whose fetch is never called when unconfigured", async () => {
    const unconfigured = stubProvider("skipped", "unconfigured");
    const spy = vi.spyOn(unconfigured, "fetchAll");

    await runProviderChain("quran", [unconfigured, stubProvider("used", "ok")]);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe("provider registration", () => {
  it("orders Quran providers with the key-free CDN last", () => {
    expect(QURAN_PROVIDERS.map((provider) => provider.name)).toEqual([
      "alquran.cloud",
      "quran.com",
      "fawazahmed0-quran-cdn",
    ]);
    expect(QURAN_PROVIDERS.every((provider) => !provider.requiresKey)).toBe(true);
  });

  it("keeps a key-free Hadith provider as the final fallback", () => {
    const last = HADITH_PROVIDERS[HADITH_PROVIDERS.length - 1];

    expect(last?.requiresKey).toBe(false);
    expect(last?.isConfigured()).toBe(true);
  });
});

describe("HADITH_BOOKS", () => {
  it("gives every book a CDN translation language and a unique slug", () => {
    const slugs = HADITH_BOOKS.map((book) => book.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(HADITH_BOOKS.every((book) => book.translationLanguage.length === 3)).toBe(true);
  });
});
