import { describe, expect, it } from "vitest";
import { capPerSource } from "@/lib/retrieval/carryForward";
import { fuseRankings } from "@/lib/retrieval/fusion";
import type { RetrievedChunk, SourceType } from "@/types";

function chunk(id: string, similarity: number, sourceType: SourceType = "quran"): RetrievedChunk {
  return {
    id,
    sourceType,
    content: id,
    citation: { sourceType, reference: id },
    similarity,
    retrievedBy: "text",
  };
}

describe("fuseRankings", () => {
  it("ranks a document both searches found above one only a single search found", () => {
    const plain = [chunk("fasting", 4), chunk("hajj", 3.6)];
    const expanded = [chunk("hajj", 6.2), chunk("months", 5.4), chunk("fasting", 3.9)];

    expect(fuseRankings([plain, expanded]).map((item) => item.id)).toEqual([
      "hajj",
      "fasting",
      "months",
    ]);
  });

  it("keeps the strongest score a document earned", () => {
    const fused = fuseRankings([[chunk("a", 3.6)], [chunk("a", 6.2)]]);
    expect(fused[0]?.similarity).toBe(6.2);
  });

  it("breaks rank ties by score", () => {
    const fused = fuseRankings([[chunk("low", 3.6)], [chunk("high", 8)]]);
    expect(fused.map((item) => item.id)).toEqual(["high", "low"]);
  });
});

describe("capPerSource", () => {
  it("applies each source's cap after judging and keeps priority order", () => {
    const chunks = [
      ...Array.from({ length: 7 }, (_, index) => chunk(`h${index}`, 5, "hadith")),
      ...Array.from({ length: 6 }, (_, index) => chunk(`q${index}`, 5, "quran")),
    ];

    const capped = capPerSource(chunks, new Set());

    expect(capped.map((item) => item.id)).toEqual(["q0", "q1", "q2", "q3", "h0", "h1", "h2", "h3"]);
  });

  it("gives a source the question asked for by name room for more than its usual share", () => {
    const chunks = Array.from({ length: 6 }, (_, index) => chunk(`s${index}`, 5, "sirat"));

    expect(capPerSource(chunks, new Set())).toHaveLength(2);
    expect(capPerSource(chunks, new Set(), ["sirat"])).toHaveLength(4);
  });

  it("never lets new results push out the evidence a follow-up carried", () => {
    const chunks = [
      chunk("q0", 9),
      chunk("q1", 8),
      chunk("q2", 7),
      chunk("q3", 6),
      chunk("carried", 0),
    ];

    expect(capPerSource(chunks, new Set(["carried"]))[0]?.id).toBe("carried");
    expect(capPerSource(chunks, new Set(["carried"]))).toHaveLength(4);
  });
});
