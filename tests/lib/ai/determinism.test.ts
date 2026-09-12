import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RetrievedChunk } from "@/types";

const generateWithChain = vi.fn();

vi.mock("@/lib/ai/auxiliaryModel", () => ({
  generateWithChain: (purpose: string, options: unknown) => generateWithChain(purpose, options),
}));

function chunk(id: string, reference: string): RetrievedChunk {
  return {
    id,
    sourceType: "hadith",
    content: `আরবি\n\nবাংলা: ${reference} এর বিবরণ`,
    citation: { sourceType: "hadith", reference },
    similarity: 5,
    retrievedBy: "text",
  };
}

const group = [chunk("a", "সহীহ বুখারী 1"), chunk("b", "সহীহ বুখারী 2"), chunk("c", "সহীহ মুসলিম 3")];

async function loadRerank() {
  vi.resetModules();
  return import("@/lib/retrieval/rerank");
}

async function loadRewriter() {
  vi.resetModules();
  return import("@/lib/ai/queryRewriter");
}

beforeEach(() => {
  generateWithChain.mockReset();
});

describe("re-rank determinism", () => {
  it("asks the model once and replays the same verdict for a repeated question", async () => {
    const { rerankContext } = await loadRerank();
    generateWithChain.mockResolvedValueOnce("1,3");

    const first = await rerankContext("নামাজ কেন ফরজ", group);
    const second = await rerankContext("নামাজ কেন ফরজ", group);

    expect(first.map((item) => item.id)).toEqual(["a", "c"]);
    expect(second.map((item) => item.id)).toEqual(["a", "c"]);
    expect(generateWithChain).toHaveBeenCalledTimes(1);
  });

  it("replays an empty verdict too, instead of flipping to a full context", async () => {
    const { rerankContext } = await loadRerank();
    generateWithChain.mockResolvedValueOnce("NONE");

    expect(await rerankContext("আজকের আবহাওয়া", group)).toHaveLength(0);
    expect(await rerankContext("আজকের আবহাওয়া", group)).toHaveLength(0);
    expect(generateWithChain).toHaveBeenCalledTimes(1);
  });

  it("judges again when the candidate set changes", async () => {
    const { rerankContext } = await loadRerank();
    generateWithChain.mockResolvedValue("1");

    await rerankContext("প্রশ্ন", group);
    await rerankContext("প্রশ্ন", group.slice(0, 2));

    expect(generateWithChain).toHaveBeenCalledTimes(2);
  });

  it("ignores question casing and spacing when replaying", async () => {
    const { rerankContext } = await loadRerank();
    generateWithChain.mockResolvedValueOnce("2");

    await rerankContext("Namaz keno forz", group);
    await rerankContext("  namaz   KENO forz ", group);

    expect(generateWithChain).toHaveBeenCalledTimes(1);
  });

  it("keeps the whole group when the model is unavailable, and does not cache that", async () => {
    const { rerankContext } = await loadRerank();
    generateWithChain.mockResolvedValueOnce(null).mockResolvedValueOnce("1");

    expect(await rerankContext("প্রশ্ন", group)).toHaveLength(3);
    expect(await rerankContext("প্রশ্ন", group)).toHaveLength(1);
  });
});

describe("query rewrite determinism", () => {
  it("rewrites a Banglish question once and reuses the search query", async () => {
    const { rewriteQuery } = await loadRewriter();
    generateWithChain.mockResolvedValueOnce("যাকাতের নিসাবের পরিমাণ কত");

    const first = await rewriteQuery("zakater nisab koto", []);
    const second = await rewriteQuery("zakater nisab koto", []);

    expect(second.query).toBe(first.query);
    expect(second.rewritten).toBe(true);
    expect(generateWithChain).toHaveBeenCalledTimes(1);
  });

  it("does not cache a rewrite that depended on conversation history", async () => {
    const { rewriteQuery } = await loadRewriter();
    generateWithChain.mockResolvedValue("ব্যাংকে চাকরি করার বিধান");

    const history = [{ role: "user" as const, text: "সুদ কি হারাম?" }];
    await rewriteQuery("তাহলে?", history);
    await rewriteQuery("তাহলে?", history);

    expect(generateWithChain).toHaveBeenCalledTimes(2);
  });

  it("never calls the model for a self-contained Bangla question", async () => {
    const { rewriteQuery } = await loadRewriter();

    const result = await rewriteQuery("নামাজ কেন ফরজ", []);

    expect(result).toEqual({ query: "নামাজ কেন ফরজ", rewritten: false });
    expect(generateWithChain).not.toHaveBeenCalled();
  });
});
