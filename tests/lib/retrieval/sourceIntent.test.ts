import { describe, expect, it } from "vitest";
import { detectSourceIntent, stripSourceMarkers } from "@/lib/retrieval/sourceIntent";
import { topicQuery } from "@/lib/retrieval/questionFiller";
import { composeNukta } from "@/lib/utils/bangla";

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

describe("searching a scoped question for its topic", () => {
  it("drops the Quran or hadith marker so it cannot outrank the topic, as in the hijab screenshot", () => {
    expect(stripSourceMarkers("পর্দা সম্পর্কে কুরআনে কী নির্দেশ এসেছে?", ["quran"])).toBe(
      "পর্দা সম্পর্কে কী নির্দেশ এসেছে?",
    );
    expect(stripSourceMarkers("নিয়ত সম্পর্কে হাদিস", ["hadith"])).toBe(
      composeNukta("নিয়ত সম্পর্কে"),
    );
  });

  it("keeps the name of ijma, qiyas, sirat or fiqh, since it is usually also the topic", () => {
    expect(stripSourceMarkers("কিয়াস কী এবং কিয়াসের রুকন কয়টি?", ["qiyas"])).toBe(
      "কিয়াস কী এবং কিয়াসের রুকন কয়টি?",
    );
  });

  it("keeps the question when nothing but the marker is left", () => {
    expect(stripSourceMarkers("কুরআন", ["quran"])).toBe("কুরআন");
  });

  it("reads Quran recitation as the topic rather than a request for Quran evidence", () => {
    expect(detectSourceIntent("কুরআন তিলাওয়াতের ফজিলত সম্পর্কে হাদিসে কী আছে?")).toEqual([
      "hadith",
    ]);
  });

  it("recognises Banglish spellings of qiyas and fiqh", () => {
    expect(detectSourceIntent("Ijma kayes ei somporke ki bole?")).toEqual(["ijma", "qiyas"]);
    expect(detectSourceIntent("hanafi mazhab e ki bole")).toEqual(["fiqh"]);
  });

  it("searches with the topic words only", () => {
    expect(topicQuery("পর্দা সম্পর্কে কী নির্দেশ এসেছে?")).toBe("পর্দা");
    expect(topicQuery("what does the say about patience")).toBe("patience");
    expect(topicQuery("কী?")).toBe("কী?");
  });
});
