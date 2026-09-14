import { describe, expect, it } from "vitest";
import { buildQuranNoteIndex, searchQuranNoteIndex } from "@/lib/retrieval/quranNoteIndex";

const unrelated: [number, Record<number, { translation: string; footnotes: string }>] = [
  100,
  Object.fromEntries(
    Array.from({ length: 40 }, (_, ayah) => [
      ayah + 1,
      {
        translation: `তারা আকাশ ও পৃথিবীর সৃষ্টি নিয়ে চিন্তা করে এবং বলে হে আমাদের রব তুমি এসব অনর্থক সৃষ্টি করোনি তুমি পবিত্র অতএব আমাদেরকে আগুনের শাস্তি থেকে রক্ষা করো ${ayah}`,
        footnotes: "",
      },
    ]),
  ),
];

const index = buildQuranNoteIndex([
  unrelated,
  [
    24,
    {
      31: {
        translation: "আর তারা তাদের গলা ও বুক যেন মাথার কাপড় দ্বারা ঢেকে রাখে",
        footnotes: "এ আয়াতে নারীদের পর্দার বিধান দেওয়া হয়েছে। পর্দা ফরয।",
      },
    },
  ],
  [
    18,
    {
      11: { translation: "অতঃপর আমি তাদের কানের উপর পর্দা দিলাম", footnotes: "" },
      12: { translation: "তারপর আমি তাদের জাগালাম", footnotes: "" },
    },
  ],
  [
    2,
    {
      183: { translation: "তোমাদের উপর সিয়াম ফরয করা হয়েছে", footnotes: "রমযানের রোযা" },
    },
  ],
]);

describe("searching the tafsir notes", () => {
  it("finds an ayah whose translation lacks the asked word but whose note has it", () => {
    const hits = searchQuranNoteIndex(index, "পর্দা সম্পর্কে কী নির্দেশ এসেছে?", 5);

    expect(hits[0]).toMatchObject({ surah: 24, ayah: 31 });
    expect(hits.map((hit) => `${hit.surah}:${hit.ayah}`)).not.toContain("18:12");
  });

  it("matches inflected forms and spelling alternates", () => {
    expect(searchQuranNoteIndex(index, "রোজার বিধান", 5)[0]).toMatchObject({ surah: 2, ayah: 183 });
  });

  it("returns nothing for a question made only of filler words", () => {
    expect(searchQuranNoteIndex(index, "কী?", 5)).toEqual([]);
  });
});
