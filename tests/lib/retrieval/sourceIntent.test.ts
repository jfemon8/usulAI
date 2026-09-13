import { describe, expect, it } from "vitest";
import { detectSourceIntent } from "@/lib/retrieval/sourceIntent";

describe("detectSourceIntent", () => {
  it("scopes a question that asks only about the Quran", () => {
    expect(detectSourceIntent("সুদ সম্পর্কে কুরআন কী বলে?")).toEqual(["quran"]);
    expect(detectSourceIntent("what does the Quran say about patience")).toEqual(["quran"]);
    expect(detectSourceIntent("Quran e sud niye ki bola ache?")).toEqual(["quran"]);
  });

  it("scopes a question that asks only for hadith", () => {
    expect(detectSourceIntent("নিয়ত সম্পর্কে হাদিস")).toEqual(["hadith"]);
    expect(detectSourceIntent("hadis e roza niye ki ache")).toEqual(["hadith"]);
  });

  it("keeps several named sources in priority order", () => {
    expect(detectSourceIntent("হাদিস ও কুরআনের আলোকে নামাজ")).toEqual(["quran", "hadith"]);
  });

  it("recognises ayah whichever way the nukta letter was typed", () => {
    expect(detectSourceIntent("রোজার আয\u09BCাত কোনটি")).toEqual(["quran"]);
    expect(detectSourceIntent("রোজার আ\u09DFাত কোনটি")).toEqual(["quran"]);
  });

  it("leaves an unscoped question open to every source", () => {
    expect(detectSourceIntent("হজ কার উপর ফরজ")).toBeNull();
    expect(detectSourceIntent("prayer facing the qibla")).toBeNull();
  });

  it("does not fire on a word that merely contains a marker", () => {
    expect(detectSourceIntent("সুরাইয়া আপার বিয়ের দাওয়াত")).toBeNull();
  });
});
