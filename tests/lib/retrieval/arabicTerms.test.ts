import { describe, expect, it } from "vitest";
import { arabicQueryTerms } from "@/lib/retrieval/arabicTerms";

describe("arabicQueryTerms", () => {
  it("turns Bangla fiqh terms into the Arabic the ijma books use", () => {
    expect(arabicQueryTerms("অজু ছাড়া নামাজ হবে কি?")).toEqual(
      expect.arrayContaining(["الوضوء", "الصلاة"]),
    );
    expect(arabicQueryTerms("সুদ সম্পর্কে ইজমা কী?")).toContain("الربا");
  });

  it("recognises inflected Bangla words", () => {
    expect(arabicQueryTerms("তালাকের পর ইদ্দতের বিধান")).toEqual(
      expect.arrayContaining(["الطلاق", "العدة"]),
    );
  });

  it("works for English questions too", () => {
    expect(arabicQueryTerms("consensus on inheritance")).toContain("المواريث");
  });

  it("maps usul terms to the Arabic the qiyas books use", () => {
    expect(arabicQueryTerms("কিয়াসের ইল্লত কীভাবে নির্ণয় হয়?")).toEqual(
      expect.arrayContaining(["القياس", "العلة"]),
    );
    expect(arabicQueryTerms("istihsan ki qiyas er biporit?")).toEqual(
      expect.arrayContaining(["الاستحسان", "القياس"]),
    );
    expect(arabicQueryTerms("লা ইলাহা ইল্লাল্লাহ")).toEqual([]);
  });

  it("maps sirah events to the Arabic the sirah books use", () => {
    expect(arabicQueryTerms("বদর যুদ্ধ ও হিজরতের ঘটনা")).toEqual(
      expect.arrayContaining(["بدر", "الهجرة"]),
    );
    expect(arabicQueryTerms("battle of khandaq in the seerah")).toContain("الخندق");
  });

  it("does not fire inside an unrelated word", () => {
    expect(arabicQueryTerms("মাসুদের গল্প")).toEqual([]);
  });

  it("maps biography names only as whole words with Bangla case endings", () => {
    expect(arabicQueryTerms("হযরত উমরের জীবনী")).toContain("عمر بن الخطاب");
    expect(arabicQueryTerms("উমরা করার নিয়ম")).not.toContain("عمر بن الخطاب");
    expect(arabicQueryTerms("আম্মাজান আয়েশা (রা.)-এর জীবনী")).toEqual(
      expect.arrayContaining(["عائشة", "أمهات المؤمنين"]),
    );
    expect(arabicQueryTerms("ইমাম আবু হানিফার জীবনী")).toContain("أبو حنيفة");
  });
});

describe("masail vocabulary", () => {
  it("maps everyday masail words to the Arabic the fiqh books use", () => {
    expect(arabicQueryTerms("সফরে কসর নামাজ কত দিন")).toEqual(
      expect.arrayContaining(["المسافر", "قصر الصلاة", "الصلاة"]),
    );
    expect(arabicQueryTerms("ইস্তেহাযার রক্ত হলে নামাজ")).toContain("الاستحاضة");
    expect(arabicQueryTerms("Can women recite the Quran aloud?")).toEqual(
      expect.arrayContaining(["القراءة", "الجهر"]),
    );
    expect(arabicQueryTerms("ব্যান্ডেজের উপর মাসেহ")).toEqual(
      expect.arrayContaining(["الجبيرة", "المسح"]),
    );
    expect(arabicQueryTerms("আত্মহত্যাকারীর জানাযা")).toEqual(
      expect.arrayContaining(["قتل نفسه", "الجنازة"]),
    );
  });

  it("keeps short words from firing inside longer ones", () => {
    expect(arabicQueryTerms("গানিমতের মাল")).not.toContain("الغناء");
    expect(arabicQueryTerms("মোজাম্মেল সাহেবের প্রশ্ন")).not.toContain("الخفين");
    expect(arabicQueryTerms("কসরত করা")).not.toContain("القصر");
  });
});

describe("combined terms", () => {
  it("asks the fiqh books about a woman's voice only when both women and voice are in the question", () => {
    expect(arabicQueryTerms("মহিলারা কি জোরে কুরআন তিলাওয়াত করতে পারবে?")).toContain(
      "نغمة المرأة",
    );
    expect(arabicQueryTerms("Can women recite the Quran loudly?")).toContain("صوت المرأة");
    expect(arabicQueryTerms("মহিলাদের পর্দার বিধান")).not.toContain("نغمة المرأة");
    expect(arabicQueryTerms("ইমাম কি জোরে কেরাত পড়বেন")).not.toContain("نغمة المرأة");
  });
});

describe("travel prayer", () => {
  it("reaches the Hanafi chapter on the traveller's prayer in Bangla and English", () => {
    expect(arabicQueryTerms("সফরে কসর নামাজ কত দিন পড়া যাবে?")).toContain("صلاة المسافر");
    expect(arabicQueryTerms("How many days can a traveller shorten his prayers?")).toContain(
      "نوى الإقامة",
    );
  });
});
