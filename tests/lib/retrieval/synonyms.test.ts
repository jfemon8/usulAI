import { describe, expect, it } from "vitest";
import { expandQuery, expandQueryTerms } from "@/lib/retrieval/synonyms";

describe("expandQueryTerms", () => {
  it("adds the corpus spelling for a user spelling", () => {
    const extras = expandQueryTerms("নামাজ কেন ফরজ");

    expect(extras).toContain("সালাত");
    expect(extras).toContain("ফরয");
  });

  it("does not repeat a term the query already uses", () => {
    expect(expandQueryTerms("সালাত কেন ফরজ")).not.toContain("সালাত");
  });

  it("matches a term carrying a Bangla suffix", () => {
    expect(expandQueryTerms("নামাজের নিয়ম")).toContain("সালাত");
  });

  it("ignores a term that is only a substring of another word", () => {
    expect(expandQueryTerms("মাসুদের গল্প")).toHaveLength(0);
  });

  it("adds a shorter term even when a longer word in the query starts with it", () => {
    expect(expandQueryTerms("মদ্যপান সম্পর্কে নিষেধাজ্ঞা")).toContain("মদ");
  });

  it("covers the Quran translation's own spellings", () => {
    expect(expandQueryTerms("হজ কার উপর ফরজ")).toEqual(expect.arrayContaining(["হজ্ব", "হজ্জ্ব"]));
    expect(expandQueryTerms("জিহাদের বিধান")).toContain("জেহাদ");
  });

  it("expands English queries too", () => {
    const extras = expandQueryTerms("prayer facing the qibla");

    expect(extras).toContain("salat");
    expect(extras).toContain("qiblah");
  });

  it("returns nothing for a query with no known term", () => {
    expect(expandQueryTerms("আজকের আবহাওয়া কেমন")).toHaveLength(0);
  });
});

describe("expandQuery", () => {
  it("appends the extra terms to the original query", () => {
    const expanded = expandQuery("হজ কার উপর ফরজ");

    expect(expanded.startsWith("হজ কার উপর ফরজ ")).toBe(true);
    expect(expanded).toContain("হজ্জ");
  });

  it("leaves an unexpandable query untouched", () => {
    expect(expandQuery("বিটকয়েনের দাম কত")).toBe("বিটকয়েনের দাম কত");
  });
});
