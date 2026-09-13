import { describe, expect, it } from "vitest";
import { transliterateArabic } from "@/lib/ai/transliterate";
import ayahs from "../../fixtures/uthmaniAyahs.json";

const ayah = (ref: keyof typeof ayahs) => ayahs[ref];

describe("transliterateArabic in English", () => {
  it.each([
    ["1:1", "bismil laahir rahmaanir raheem"],
    ["1:2", "alhamdu lillaahi rabbil aalameen"],
    ["112:2", "allaahus samad"],
    ["112:3", "lam yalid walam yoolad"],
    ["112:4", "walam yakul lahoo kufuwan ahad"],
  ] as const)("reads %s the way a published transliteration does", (ref, expected) => {
    expect(transliterateArabic(ayah(ref), "en")).toBe(expected);
  });

  it("links the definite article across words and assimilates sun letters", () => {
    expect(transliterateArabic(ayah("2:276"), "en")).toBe(
      "yamhaqul laahur ribaa wayurbis sadaqaat wallaahu laa yuhibbu kulla kaffaarin atheem",
    );
  });

  it("treats a maddah after fatha as a long vowel, not a glottal stop", () => {
    expect(transliterateArabic(ayah("2:255"), "en").startsWith("allaahu laa ilaaha illaa")).toBe(
      true,
    );
  });

  it("does not give lahu the long vowel that belongs to Allah", () => {
    expect(transliterateArabic(ayah("2:255"), "en")).toContain(" lahoo maa ");
  });

  it("stops at a pause mark instead of carrying the vowel into the next word", () => {
    const reading = transliterateArabic(ayah("2:255"), "en");

    expect(reading).toContain("qayyoom laa");
    expect(reading).toContain("sinatun walaa nawm lahoo");
  });

  it("opens with al- when the article lam is merged into a doubled lam", () => {
    const merged = String.fromCodePoint(
      0x0671,
      0x0644,
      0x0651,
      0x064e,
      0x0630,
      0x0650,
      0x064a,
      0x0646,
      0x064e,
    );

    expect(transliterateArabic(merged, "en")).toBe("alladheen");
    expect(transliterateArabic(merged, "bn")).toBe("আল্লাযীন");
  });

  it("does not let a silent waw lengthen the vowel before it", () => {
    expect(transliterateArabic("فَأُو۟لَٰٓئِكَ أَصْحَٰبُ ٱلنَّارِ", "en")).toBe(
      "fa'ulaa'ika ashaabun naar",
    );
  });

  it("keeps the rounded-zero letters silent", () => {
    expect(transliterateArabic(ayah("1:7"), "en")).toContain("walad daalleen");
  });

  it("reads a fully vocalised hadith matn", () => {
    const matn = "مَا زَالَ جِبْرِيلُ يُوصِينِي بِالْجَارِ حَتَّى ظَنَنْتُ أَنَّهُ سَيُوَرِّثُهُ";

    expect(transliterateArabic(matn, "en")).toBe(
      "maa zaala jibreelu yooseenee biljaari hattaa zanantu annahu sayuwarrithuh",
    );
  });

  it("uses fixed readings for honorifics that the corpus leaves unvocalised", () => {
    expect(transliterateArabic("رَسُولَ اللَّهِ صلى الله عليه وسلم يَقُولُ", "en")).toBe(
      "rasoolal laahi sallallaahu 'alaihi wa sallam yaqool",
    );
  });
});

describe("transliterateArabic in Bangla", () => {
  it.each([
    ["1:1", "বিসমিল লাহির রাহমানির রাহীম"],
    ["1:2", "আলহামদু লিল্লাহি রাব্বিল আলামীন"],
    ["112:2", "আল্লাহুস সামাদ"],
    ["112:3", "লাম ইয়ালিদ ওয়ালাম ইউলাদ"],
  ] as const)("renders %s in Bangla script", (ref, expected) => {
    expect(transliterateArabic(ayah(ref), "bn")).toBe(expected);
  });

  it("writes doubled consonants as conjuncts", () => {
    expect(transliterateArabic(ayah("2:276"), "bn")).toContain("ইউহিব্বু কুল্লা");
  });

  it("writes a doubled ya the conventional way", () => {
    expect(transliterateArabic("إِيَّاكَ نَعْبُدُ", "bn")).toBe("ইয়্যাকা নাবুদ");
  });

  it("never mixes Latin letters into the Bangla reading", () => {
    for (const text of Object.values(ayahs)) {
      expect(transliterateArabic(text, "bn")).not.toMatch(/\p{Script=Latin}/u);
    }
  });

  it("never leaves Arabic letters behind in either reading", () => {
    for (const text of Object.values(ayahs)) {
      expect(transliterateArabic(text, "bn")).not.toMatch(/\p{Script=Arabic}/u);
      expect(transliterateArabic(text, "en")).not.toMatch(/\p{Script=Arabic}/u);
    }
  });
});
