import { describe, expect, it } from "vitest";
import {
  BROKEN_ENTITY,
  repairBanglaTranslation,
  repairedAyahCount,
} from "@/lib/ingestion/sources/providers/quran/repairs";

const brokenHajjAyah =
  "আর এ ঘরের হজ্ব করা হলো মানুষের উপর আল্লাহর প্রাপ্য; যে লোকের সামর্থ?2480;য়েছে এ পর্যন্ত পৌছার।";

describe("repairBanglaTranslation", () => {
  it("restores the words the upstream encoding broke", () => {
    const repaired = repairBanglaTranslation(3, 97, brokenHajjAyah);

    expect(repaired).toContain("সামর্থ্য রয়েছে");
    expect(BROKEN_ENTITY.test(repaired)).toBe(false);
  });

  it("matches the source whether its nukta letters are precomposed or not", () => {
    const precomposed = brokenHajjAyah.replace("\u09AF\u09BC", "\u09DF");
    expect(BROKEN_ENTITY.test(repairBanglaTranslation(3, 97, precomposed))).toBe(false);
  });

  it("leaves every other ayah byte for byte", () => {
    expect(repairBanglaTranslation(2, 255, brokenHajjAyah)).toBe(brokenHajjAyah);
  });

  it("covers all seventeen corrupted ayahs", () => {
    expect(repairedAyahCount()).toBe(17);
  });
});
