import { beforeEach, describe, expect, it, vi } from "vitest";

const embed = vi.fn();
const embedMany = vi.fn();

vi.mock("ai", () => ({
  embed: (options: unknown) => embed(options),
  embedMany: (options: unknown) => embedMany(options),
}));

vi.mock("@/lib/ai/providers", () => ({
  getEmbeddingModel: () => "model",
}));

async function loadModule() {
  vi.resetModules();
  return import("@/lib/ai/embeddings");
}

beforeEach(() => {
  embed.mockReset();
  embedMany.mockReset();
});

describe("embedText", () => {
  it("embeds a query once and serves repeats from cache", async () => {
    const { embedText, queryCacheStats } = await loadModule();
    embed.mockResolvedValue({ embedding: [0.1, 0.2] });

    const first = await embedText("যাকাতের নিসাব কত");
    const second = await embedText("যাকাতের নিসাব কত");

    expect(second).toEqual(first);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(queryCacheStats().hits).toBe(1);
  });

  it("treats case and spacing differences as the same query", async () => {
    const { embedText } = await loadModule();
    embed.mockResolvedValue({ embedding: [0.3] });

    await embedText("Zakater nisab koto");
    await embedText("  zakater   NISAB koto  ");

    expect(embed).toHaveBeenCalledTimes(1);
  });

  it("embeds a different query separately", async () => {
    const { embedText } = await loadModule();
    embed.mockResolvedValue({ embedding: [0.4] });

    await embedText("নামাজ কেন ফরজ");
    await embedText("হজ কার উপর ফরজ");

    expect(embed).toHaveBeenCalledTimes(2);
  });

  it("requests the query task type, not the document one", async () => {
    const { embedText } = await loadModule();
    embed.mockResolvedValue({ embedding: [0.5] });

    await embedText("প্রশ্ন");

    expect(embed.mock.calls[0]?.[0]).toMatchObject({
      providerOptions: { google: { taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 } },
    });
  });

  it("starts a cooldown after the provider rejects the key", async () => {
    const { embedText, embeddingsCoolingDown } = await loadModule();
    embed.mockRejectedValue(new Error("403 PERMISSION_DENIED: API key not valid"));

    expect(embeddingsCoolingDown()).toBe(false);
    await expect(embedText("প্রশ্ন")).rejects.toThrow();
    expect(embeddingsCoolingDown()).toBe(true);
  });

  it("does not start a cooldown for a rate limit", async () => {
    const { embedText, embeddingsCoolingDown } = await loadModule();
    embed.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED: quota exceeded"));

    await expect(embedText("প্রশ্ন")).rejects.toThrow();
    expect(embeddingsCoolingDown()).toBe(false);
  });

  it("does not cache a failed embedding", async () => {
    const { embedText } = await loadModule();
    embed.mockRejectedValueOnce(new Error("429 RESOURCE_EXHAUSTED"));
    embed.mockResolvedValueOnce({ embedding: [0.6] });

    await expect(embedText("প্রশ্ন")).rejects.toThrow();
    expect(await embedText("প্রশ্ন")).toEqual([0.6]);
    expect(embed).toHaveBeenCalledTimes(2);
  });
});

describe("embedTexts", () => {
  it("skips the provider entirely for an empty batch", async () => {
    const { embedTexts } = await loadModule();

    expect(await embedTexts([])).toEqual([]);
    expect(embedMany).not.toHaveBeenCalled();
  });

  it("uses the document task type for ingestion", async () => {
    const { embedTexts } = await loadModule();
    embedMany.mockResolvedValue({ embeddings: [[0.7]] });

    await embedTexts(["আয়াত"]);

    expect(embedMany.mock.calls[0]?.[0]).toMatchObject({
      providerOptions: { google: { taskType: "RETRIEVAL_DOCUMENT" } },
    });
  });
});
