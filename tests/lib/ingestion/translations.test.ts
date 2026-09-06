import { describe, expect, it } from "vitest";
import { buildSourceContent, normalizeText } from "@/lib/ingestion/translations";

describe("buildSourceContent", () => {
  it("keeps the Arabic first and labels both translations", () => {
    const content = buildSourceContent(
      "ٱلْحَمْدُ لِلَّهِ",
      "যাবতীয় প্রশংসা আল্লাহর",
      "All praise is due to Allah",
    );

    expect(content).toBe(
      "ٱلْحَمْدُ لِلَّهِ\n\nবাংলা: যাবতীয় প্রশংসা আল্লাহর\n\nEnglish: All praise is due to Allah",
    );
  });

  it("omits a translation that is missing rather than leaving an empty label", () => {
    const content = buildSourceContent("عربي", "", "English text");

    expect(content).toBe("عربي\n\nEnglish: English text");
    expect(content).not.toContain("বাংলা:");
  });

  it("keeps Arabic alone when no translation exists", () => {
    expect(buildSourceContent("عربي", "", "")).toBe("عربي");
  });

  it("strips a leading BOM", () => {
    expect(normalizeText("﻿بِسْمِ")).toBe("بِسْمِ");
    expect(buildSourceContent("﻿بِسْمِ", "", "").startsWith("﻿")).toBe(false);
  });
});
