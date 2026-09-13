import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/ingestion/chunker";

const sentence = "ইজমা হলো কোনো যুগের মুজতাহিদ আলেমদের সর্বসম্মত সিদ্ধান্ত। ";

describe("chunkText", () => {
  it("returns short text as a single chunk", () => {
    expect(chunkText("ইজমার সংজ্ঞা।", 800, 120)).toEqual(["ইজমার সংজ্ঞা।"]);
  });

  it("ends chunks at a sentence boundary instead of mid-word", () => {
    const chunks = chunkText(sentence.repeat(40), 300, 60);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(0, -1)) expect(chunk.endsWith("।")).toBe(true);
  });

  it("starts the overlap at a word, never inside one", () => {
    const words = "আলেমদের ".repeat(200);
    const chunks = chunkText(words, 200, 50);

    for (const chunk of chunks) expect(chunk.startsWith("আলেমদের")).toBe(true);
  });

  it("prefers a paragraph break when one is close to the limit", () => {
    const text = `${"ক".repeat(250)}\n\n${"খ".repeat(250)}`;
    const [first] = chunkText(text, 300, 30);

    expect(first).toBe("ক".repeat(250));
  });

  it("keeps every character of the source across the chunks", () => {
    const text = sentence.repeat(30).trim();
    const joined = chunkText(text, 250, 40).join(" ");

    for (const word of text.split(/\s+/)) expect(joined).toContain(word);
  });

  it("still terminates on text with no break characters at all", () => {
    const chunks = chunkText("ক".repeat(1000), 300, 50);

    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks.every((chunk) => chunk.length <= 300)).toBe(true);
  });
});
