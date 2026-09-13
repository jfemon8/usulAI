import { describe, expect, it } from "vitest";
import {
  buildSourceContent,
  normalizeText,
  sanitizeSourceContent,
} from "@/lib/ingestion/translations";

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
    expect(normalizeText("\uFEFFبِسْمِ")).toBe("بِسْمِ");
    expect(buildSourceContent("\uFEFFبِسْمِ", "", "").startsWith("\uFEFF")).toBe(false);
  });
});

const abuDawud5152 = `حَدَّثَنَا مُحَمَّدُ بْنُ عِيسَى، عَنْ عَبْدِ اللَّهِ بْنِ عَمْرٍو \u200F"\u200F مَا زَالَ جِبْرِيلُ يُوصِينِي بِالْجَارِ حَتَّى ظَنَنْتُ أَنَّهُ سَيُوَرِّثُهُ \u200F"\u200F

বাংলা: । আব্দুল্লাহ ইবনু আমর (রাঃ) সূত্রে বর্ণিত। এমন কি আমার ধারণা হলো, তিনি হয় তো প্রতিবেশীকে উত্তরাধিকারী বানিয়ে দিবেন।[1] সহীহ।

English: Narrated Abdullah ibn Amr: Gabriel kept on commending the neighbour to me [2] so that I thought he would make an heir?`;

describe("sanitizeSourceContent", () => {
  it("removes the stray danda that opens a hadith translation", () => {
    expect(sanitizeSourceContent(abuDawud5152)).toContain("বাংলা: আব্দুল্লাহ ইবনু আমর");
    expect(sanitizeSourceContent(abuDawud5152)).not.toContain("বাংলা: ।");
  });

  it("removes footnote markers that look exactly like citation markers", () => {
    const cleaned = sanitizeSourceContent(abuDawud5152);

    expect(cleaned).toContain("বানিয়ে দিবেন। সহীহ।");
    expect(cleaned).not.toMatch(/\[\d+\]/);
  });

  it("leaves the Arabic block byte for byte", () => {
    const arabic = abuDawud5152.split("\n\n")[0];

    expect(sanitizeSourceContent(abuDawud5152).split("\n\n")[0]).toBe(arabic);
  });

  it("keeps brackets that are not numeric footnotes", () => {
    const content = "বাংলা: রাসূল [সাল্লাল্লাহু আলাইহি ওয়াসাল্লাম] বলেছেন।";

    expect(sanitizeSourceContent(content)).toBe(content);
  });

  it("handles Bengali-digit footnotes too", () => {
    expect(sanitizeSourceContent("বাংলা: সহীহ হাদিস।[১]")).toBe("বাংলা: সহীহ হাদিস।");
  });
});
