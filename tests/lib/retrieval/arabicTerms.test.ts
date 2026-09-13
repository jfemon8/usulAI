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

  it("does not fire inside an unrelated word", () => {
    expect(arabicQueryTerms("মাসুদের গল্প")).toEqual([]);
  });
});
