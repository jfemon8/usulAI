import { describe, expect, it } from "vitest";
import { buildRagPrompt, buildSystemPrompt } from "@/lib/ai/prompt";
import { SOURCE_PRIORITY } from "@/config/site";
import type { RetrievedChunk } from "@/types";

const chunk: RetrievedChunk = {
  id: "1",
  sourceType: "quran",
  content: "ٱلْحَمْدُ لِلَّهِ\n\nযাবতীয় প্রশংসা আল্লাহর",
  citation: { sourceType: "quran", reference: "Al-Faatiha 1:2" },
  similarity: 0.9,
  retrievedBy: "vector",
};

describe("buildSystemPrompt", () => {
  it("makes citations mandatory", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("রেফারেন্স ছাড়া কোনো উত্তর দেওয়া যাবে না");
    expect(prompt).toContain("সূত্র:");
    expect(prompt).toContain("কোনো রেফারেন্স বানিয়ে লিখো না");
  });

  it("makes a Bangla answer mandatory for Bangla and Banglish questions", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("বাংলিশে");
    expect(prompt).toContain("উত্তর অবশ্যই বাংলায় দিতে হবে");
  });

  it("requires the Arabic to be kept and paired with a translation", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("আরবি কখনো বাদ দিও না");
    expect(prompt).toContain("বাংলা অনুবাদ");
    expect(prompt).toContain("ইংরেজি অনুবাদ");
    expect(prompt).toContain("নিজে নতুন করে অনুবাদ করো না");
  });

  it("lists every configured source in priority order", () => {
    const prompt = buildSystemPrompt();
    const listed = SOURCE_PRIORITY.map((_, index) => `${index + 1}.`);

    for (const marker of listed) {
      expect(prompt).toContain(marker);
    }
    expect(prompt).toContain("পাঁচটা");
  });
});

describe("buildRagPrompt", () => {
  it("numbers context entries so the model can cite them", () => {
    const prompt = buildRagPrompt("প্রশ্ন", [chunk]);

    expect(prompt).toContain("[1] (কুরআন — Al-Faatiha 1:2)");
    expect(prompt).toContain("[নম্বর] বসাও");
  });

  it("tells the model to answer in Bangla for a Bengali-script question", () => {
    expect(buildRagPrompt("নামাজের নিয়ম কী?", [chunk])).toContain("ইউজার বাংলায় প্রশ্ন করেছে");
  });

  it("tells the model to answer in Bangla script for a Banglish question", () => {
    const prompt = buildRagPrompt("namaz er niyom ki", [chunk]);

    expect(prompt).toContain("বাংলিশে");
    expect(prompt).toContain("বাংলা হরফে");
  });

  it("mirrors the user's language for a non-Bangla question", () => {
    const prompt = buildRagPrompt("What are the conditions of prayer?", [chunk]);

    expect(prompt).toContain("ইউজারের প্রশ্ন যে ভাষায়, উত্তরও সেই ভাষায়");
  });

  it("asks for the Bangla translation on Bangla and Banglish questions", () => {
    for (const question of ["নামাজের নিয়ম কী?", "namaz er niyom ki"]) {
      const prompt = buildRagPrompt(question, [chunk]);

      expect(prompt, question).toContain('"বাংলা:" অনুবাদটা দাও');
      expect(prompt, question).not.toContain('"English:" অনুবাদটা দাও');
    }
  });

  it("asks for the English translation on other-language questions", () => {
    const prompt = buildRagPrompt("What are the conditions of prayer?", [chunk]);

    expect(prompt).toContain('"English:" অনুবাদটা দাও');
    expect(prompt).not.toContain('"বাংলা:" অনুবাদটা দাও');
  });

  it("says plainly when no context was retrieved", () => {
    expect(buildRagPrompt("প্রশ্ন", [])).toContain("কোনো প্রাসঙ্গিক তথ্য পাওয়া যায়নি");
  });
});
