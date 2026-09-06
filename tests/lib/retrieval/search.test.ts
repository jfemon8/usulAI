import { describe, expect, it } from "vitest";
import { FILE_SOURCES, SOURCE_PRIORITY } from "@/config/site";

describe("SOURCE_PRIORITY", () => {
  it("enforces Quran -> Hadith -> Ijma -> Qiyas -> Sirat order", () => {
    expect(SOURCE_PRIORITY).toEqual(["quran", "hadith", "ijma", "qiyas", "sirat"]);
  });

  it("keeps Quran and Hadith ahead of every file-backed source", () => {
    const firstFileSourceIndex = Math.min(
      ...FILE_SOURCES.map((source) => SOURCE_PRIORITY.indexOf(source)),
    );

    expect(SOURCE_PRIORITY.indexOf("quran")).toBeLessThan(firstFileSourceIndex);
    expect(SOURCE_PRIORITY.indexOf("hadith")).toBeLessThan(firstFileSourceIndex);
  });
});
