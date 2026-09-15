import { describe, expect, it } from "vitest";
import { buildQuranVerseIndex, findQuranVerse } from "@/lib/retrieval/quranVerseIndex";
import ayahs from "../../fixtures/uthmaniAyahs.json";

const index = buildQuranVerseIndex(
  Object.entries(ayahs as Record<string, string>).map(([key, arabic]) => {
    const [surah, ayah] = key.split(":").map(Number);
    return { reference: `Q ${key}`, surah: surah!, ayah: ayah!, arabic };
  }),
);

function words(text: string, from: number, to: number): string {
  return text.split(/\s+/).slice(from, to).join(" ");
}

describe("findQuranVerse", () => {
  const verse = (ayahs as Record<string, string>)["2:276"]!;

  it("finds the ayah a model quoted from memory, even without harakat", () => {
    const bare = words(verse, 0, 6).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
    const match = findQuranVerse(index, bare);

    expect(match?.verse.reference).toBe("Q 2:276");
    expect(match?.matchedLetters).toBeGreaterThanOrEqual(12);
  });

  it("returns the corpus wording for the matched part", () => {
    const match = findQuranVerse(index, words(verse, 1, 5));
    expect(match?.segment).toBe(words(verse, 1, 5));
  });

  it("rejects Arabic that is not a Quran verse", () => {
    expect(findQuranVerse(index, "ما زال جبريل يوصيني بالجار حتى ظننت أنه سيورثه")).toBeNull();
    expect(findQuranVerse(index, "الله أكبر")).toBeNull();
  });
});
