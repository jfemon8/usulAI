import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn() }));

const { packSurahNotes, unpackSurahNotes } = await import("@/lib/retrieval/quranNoteStore");
const { ayahPosition } = await import("@/lib/retrieval/quranNotes");

describe("packSurahNotes", () => {
  const notes = {
    1: {
      translation: "পরম করুণাময় অতি দয়ালু আল্লাহর নামে।",
      footnotes: "[১] বিসমিল্লাহ সম্পর্কে টীকা।",
    },
    2: { translation: "সকল প্রশংসা আল্লাহর।", footnotes: "" },
  };

  it("round-trips a surah's notes unchanged", () => {
    expect(unpackSurahNotes(packSurahNotes(notes).notes)).toEqual(notes);
  });

  it("gives identical notes the same hash so unchanged surahs are not rewritten", () => {
    expect(packSurahNotes(notes).hash).toBe(packSurahNotes({ ...notes }).hash);
    expect(packSurahNotes({ ...notes, 2: { translation: "ভিন্ন", footnotes: "" } }).hash).not.toBe(
      packSurahNotes(notes).hash,
    );
  });

  it("stores repetitive Bangla text smaller than its JSON", () => {
    const long = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [index + 1, notes[1]]),
    );
    expect(packSurahNotes(long).bytes).toBeLessThan(JSON.stringify(long).length / 4);
  });
});

describe("ayahPosition", () => {
  it("reads surah and ayah from a Quran reference", () => {
    expect(ayahPosition("Al-Baqara 2:255")).toEqual({ surah: 2, ayah: 255 });
  });

  it("returns nothing for a reference without a position", () => {
    expect(ayahPosition("সহীহ বুখারী 1454")).toBeNull();
  });
});
