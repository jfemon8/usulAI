import { describe, expect, it } from "vitest";
import { buildRerankSnippet } from "@/lib/retrieval/rerank";
import { RERANK_CONFIG } from "@/config/site";

const arabic =
  "حَدَّثَنَا مُسَدَّدٌ قَالَ حَدَّثَنَا يَحْيَى عَنْ شُعْبَةَ قَالَ حَدَّثَنِي زِيَادٌ";
const bangla = "মিথ্যা সাক্ষ্য দেওয়া কবীরা গুনাহ।";
const english = "Giving false witness is a major sin.";

describe("buildRerankSnippet", () => {
  it("starts with the Bangla translation instead of the Arabic", () => {
    const snippet = buildRerankSnippet(`${arabic}\n\nবাংলা: ${bangla}\n\nEnglish: ${english}`);

    expect(snippet.startsWith(`বাংলা: ${bangla}`)).toBe(true);
    expect(snippet).not.toContain("حَدَّثَنَا");
  });

  it("keeps the English translation when there is no Bangla one", () => {
    const snippet = buildRerankSnippet(`${arabic}\n\nEnglish: ${english}`);

    expect(snippet).toBe(`English: ${english}`);
  });

  it("falls back to the raw content when no translation is labelled", () => {
    expect(buildRerankSnippet("ইজমার সংজ্ঞা হলো মুজতাহিদদের ঐক্যমত।")).toBe(
      "ইজমার সংজ্ঞা হলো মুজতাহিদদের ঐক্যমত।",
    );
  });

  it("collapses whitespace and respects the snippet length", () => {
    const long = `${arabic}\n\nবাংলা: ${bangla.repeat(40)}`;
    const snippet = buildRerankSnippet(long);

    expect(snippet).toHaveLength(RERANK_CONFIG.snippetChars);
    expect(snippet).not.toMatch(/\s{2,}/);
  });
});
