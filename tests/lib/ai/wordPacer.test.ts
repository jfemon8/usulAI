import { describe, expect, it } from "vitest";
import { createWordPacer, takeCompleteWords, wordsPerTick } from "@/lib/ai/wordPacer";

describe("takeCompleteWords", () => {
  it("keeps a word that may still be growing", () => {
    expect(takeCompleteWords("যাকাত ফর")).toEqual({ words: ["যাকাত "], rest: "ফর" });
  });

  it("keeps line breaks attached to their word", () => {
    expect(takeCompleteWords("প্রথম\n\nদ্বিতীয় ")).toEqual({
      words: ["প্রথম\n\n", "দ্বিতীয় "],
      rest: "",
    });
  });
});

describe("wordsPerTick", () => {
  it("sends one word per tick when little is waiting", () => {
    expect(wordsPerTick(10, 24, 3000)).toBe(1);
  });

  it("speeds up so a whole buffered answer never lags more than the cap", () => {
    const backlog = 900;
    const perTick = wordsPerTick(backlog, 24, 3000);
    expect(Math.ceil(backlog / perTick) * 24).toBeLessThanOrEqual(3000);
  });
});

describe("createWordPacer", () => {
  it("delivers a buffered answer as many small word chunks with the exact text", async () => {
    const chunks: string[] = [];
    const pacer = createWordPacer({ write: (chunk) => chunks.push(chunk), sleep: async () => {} });
    const answer = "যাকাত ধনীদের উপর ফরজ [1]।\n\nআরবি: وَءَاتُوا۟ ٱلزَّكَوٰةَ";

    pacer.push(answer);
    await pacer.finish();

    expect(chunks.join("")).toBe(answer);
    expect(chunks.length).toBeGreaterThan(5);
  });

  it("joins character-by-character model output back into whole words", async () => {
    const chunks: string[] = [];
    const pacer = createWordPacer({ write: (chunk) => chunks.push(chunk), sleep: async () => {} });

    for (const character of "নামাজ কেন ফরজ") pacer.push(character);
    await pacer.finish();

    expect(chunks.join("")).toBe("নামাজ কেন ফরজ");
    expect(chunks.every((chunk) => !/^\S+$/.test(chunk) || chunk === "ফরজ")).toBe(true);
  });

  it("reports whether anything was pushed", () => {
    const pacer = createWordPacer({ write: () => {}, sleep: async () => {} });
    expect(pacer.started()).toBe(false);
    pacer.push("শব্দ");
    expect(pacer.started()).toBe(true);
  });
});
