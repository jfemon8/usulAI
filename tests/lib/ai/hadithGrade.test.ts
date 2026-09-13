import { describe, expect, it } from "vitest";
import {
  banglaGrade,
  banglaGraderName,
  describeGrades,
  isWeakGrade,
  preferredGrade,
} from "@/lib/ai/hadithGrade";

const abuDawud5 = [
  { name: "Al-Albani", grade: "Shadh" },
  { name: "Muhammad Muhyi Al-Din Abdul Hamid", grade: "Shadh" },
  { name: "Zubair Ali Zai", grade: "Isnaad Sahih" },
];

describe("banglaGrade", () => {
  it.each([
    ["Sahih", "সহীহ"],
    ["Hasan Sahih", "হাসান সহীহ"],
    ["Da`if", "যঈফ"],
    ["Da'if", "যঈফ"],
    ["Isnaad Sahih", "সনদ সহীহ"],
    ["Maudu", "মাওযূ (জাল)"],
    ["Isnaad Sahih Bukhari And Muslim", "সনদ সহীহ বুখারী ও মুসলিম"],
  ])("renders %s as %s", (grade, expected) => {
    expect(banglaGrade(grade)).toBe(expected);
  });
});

describe("banglaGraderName", () => {
  it("names the well-known graders in Bangla", () => {
    expect(banglaGraderName("Al-Albani")).toBe("আলবানী");
    expect(banglaGraderName("Zubair Ali Zai")).toBe("যুবাইর আলী যাই");
  });

  it("keeps an unknown grader's name as given rather than guessing", () => {
    expect(banglaGraderName("Some New Scholar")).toBe("Some New Scholar");
  });
});

describe("describeGrades", () => {
  it("lists every grader with their verdict so disagreement stays visible", () => {
    expect(describeGrades(abuDawud5)).toBe(
      "শায (আলবানী); শায (মুহিউদ্দীন আব্দুল হামিদ); সনদ সহীহ (যুবাইর আলী যাই)",
    );
  });

  it("says nothing when a collection publishes no grades", () => {
    expect(describeGrades(undefined)).toBeUndefined();
    expect(describeGrades([])).toBeUndefined();
  });
});

describe("preferredGrade", () => {
  it("prefers al-Albani's verdict for the short chip label", () => {
    expect(preferredGrade(abuDawud5)).toBe("শায (আলবানী)");
  });

  it("falls back to the first grader when al-Albani did not grade it", () => {
    expect(preferredGrade([{ name: "Ahmad Muhammad Shakir", grade: "Sahih" }])).toBe(
      "সহীহ (আহমাদ শাকির)",
    );
  });
});

describe("isWeakGrade", () => {
  it("flags weak, fabricated and irregular narrations", () => {
    expect(isWeakGrade("Da'if")).toBe(true);
    expect(isWeakGrade("Maudu")).toBe(true);
    expect(isWeakGrade("Shadh")).toBe(true);
  });

  it("does not flag sound narrations", () => {
    expect(isWeakGrade("Hasan Sahih")).toBe(false);
    expect(isWeakGrade("Isnaad Sahih")).toBe(false);
  });
});
