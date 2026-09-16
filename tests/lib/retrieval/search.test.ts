import { describe, expect, it } from "vitest";
import { CONTEXT_CONFIG, FILE_SOURCES, HYBRID_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { selectForEmbedding } from "@/lib/retrieval/search";

describe("SOURCE_PRIORITY", () => {
  it("enforces Quran -> Hadith -> Ijma -> Qiyas -> Sirat order", () => {
    expect(SOURCE_PRIORITY).toEqual(["quran", "hadith", "ijma", "qiyas", "sirat", "fiqh"]);
  });

  it("keeps Quran and Hadith ahead of every file-backed source", () => {
    const firstFileSourceIndex = Math.min(
      ...FILE_SOURCES.map((source) => SOURCE_PRIORITY.indexOf(source)),
    );

    expect(SOURCE_PRIORITY.indexOf("quran")).toBeLessThan(firstFileSourceIndex);
    expect(SOURCE_PRIORITY.indexOf("hadith")).toBeLessThan(firstFileSourceIndex);
  });
});

describe("lazy embedding selection", () => {
  const ids = Array.from({ length: 40 }, (_, index) => `doc-${index}`);

  it("spends the budget on documents that have no vector, in retrieval order", () => {
    const pending = ["doc-31", "doc-4", "doc-18"].map((id) => ({ id, content: id }));

    expect(selectForEmbedding(ids, pending, 2).map((row) => row.id)).toEqual(["doc-4", "doc-18"]);
  });

  it("keeps every pending document when the budget is larger than the list", () => {
    const pending = ["doc-2", "doc-9"].map((id) => ({ id, content: id }));

    expect(selectForEmbedding(ids, pending, 12)).toHaveLength(2);
  });

  it("looks beyond the answer's own context, which is already embedded", () => {
    expect(HYBRID_CONFIG.lazyEmbedCandidates).toBeGreaterThan(CONTEXT_CONFIG.maxContextChunks);
    expect(HYBRID_CONFIG.lazyEmbedCandidates).toBeGreaterThanOrEqual(
      HYBRID_CONFIG.lazyEmbedPerRequest,
    );
  });
});
