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
  it("forbids em-dashes and mixed-script words", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("লম্বা ড্যাশ");
    expect(prompt).toContain("দুই লিপি মিশাবে না");
  });

  it("makes citations mandatory", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("রেফারেন্স ছাড়া কোনো উত্তর দেওয়া যাবে না");
    expect(prompt).toContain("কোনো তালিকা লিখবে না");
    expect(prompt).toContain("কোনো রেফারেন্স বানিয়ে লিখো না");
  });

  it("makes a Bangla answer mandatory for Bangla and Banglish questions", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("বাংলিশে");
    expect(prompt).toContain("উত্তর অবশ্যই বাংলায় দিতে হবে");
  });

  it("requires the Arabic verbatim and leaves pronunciation and meaning to the app", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("আরবি কখনো বাদ দিও না");
    expect(prompt).toContain("নিজের আলাদা অনুচ্ছেদে");
    expect(prompt).toContain("উচ্চারণ, বাংলা অর্থ বা ইংরেজি অর্থ তুমি নিজে লিখবে না");
    expect(prompt).toContain("নিজে নতুন করে অনুবাদ বানিও না");
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

    expect(prompt).toContain("[1] (কুরআন, Al-Faatiha 1:2)");
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
    expect(prompt).toContain("never in Bangla");
  });

  it("tells every language to quote Arabic alone and not to write its own translation", () => {
    for (const question of [
      "নামাজের নিয়ম কী?",
      "namaz er niyom ki",
      "What are the conditions of prayer?",
    ]) {
      const prompt = buildRagPrompt(question, [chunk]);

      expect(prompt, question).toContain("মূল আরবি আলাদা অনুচ্ছেদে হুবহু দাও");
      expect(prompt, question).toContain("উচ্চারণ বা অর্থ লিখবে না");
      expect(prompt, question).not.toContain("অনুবাদটা দাও");
    }
  });

  it("strips source footnotes without touching the context numbering", () => {
    const footnoted: RetrievedChunk = {
      ...chunk,
      sourceType: "hadith",
      content: "আরবি\n\nবাংলা: । উত্তরাধিকারী বানিয়ে দিবেন।[1] সহীহ।",
      citation: { sourceType: "hadith", reference: "সুনানে আবু দাউদ 5152" },
    };
    const prompt = buildRagPrompt("প্রশ্ন", [footnoted]);

    expect(prompt).toContain("[1] (হাদিস, সুনানে আবু দাউদ 5152)");
    expect(prompt).toContain("বাংলা: উত্তরাধিকারী বানিয়ে দিবেন। সহীহ।");
    expect(prompt).not.toContain("দিবেন।[1]");
  });

  it("says plainly when no context was retrieved", () => {
    expect(buildRagPrompt("প্রশ্ন", [])).toContain("কোনো প্রাসঙ্গিক তথ্য পাওয়া যায়নি");
  });
});

describe("buildRagPrompt enrichment of the context", () => {
  it("labels a graded hadith with every grader's verdict", () => {
    const graded: RetrievedChunk = {
      ...chunk,
      sourceType: "hadith",
      citation: { sourceType: "hadith", reference: "সুনানে আবু দাউদ 5" },
      grades: [
        { name: "Al-Albani", grade: "Shadh" },
        { name: "Zubair Ali Zai", grade: "Isnaad Sahih" },
      ],
    };

    expect(buildRagPrompt("প্রশ্ন", [graded])).toContain(
      "[1] (হাদিস, সুনানে আবু দাউদ 5, মান: শায (আলবানী); সনদ সহীহ (যুবাইর আলী যাই))",
    );
  });

  it("adds the tafsir note under an ayah and names its author", () => {
    const prompt = buildRagPrompt("প্রশ্ন", [
      { ...chunk, note: "সকল প্রশংসা আল্লাহর টীকা: (১) ব্যাখ্যা" },
    ]);

    expect(prompt).toContain(
      "তাফসীরি অনুবাদ ও টীকা (ড. আবু বকর মুহাম্মাদ যাকারিয়া, QuranEnc.com)",
    );
  });

  it("tells the model never to present a note as part of the ayah", () => {
    expect(buildSystemPrompt()).toContain(
      "টীকাকে কখনো আয়াতের অংশ বা আল্লাহর বাণী হিসেবে উপস্থাপন করবে না",
    );
  });
});
