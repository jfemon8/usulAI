import { describe, expect, it } from "vitest";
import {
  detectConversationLanguage,
  detectQuestionLanguage,
  shouldAnswerInBangla,
} from "@/lib/ai/language";

describe("detectQuestionLanguage", () => {
  it("detects Bengali script", () => {
    expect(detectQuestionLanguage("নামাজের নিয়ম কী?")).toBe("bangla");
    expect(detectQuestionLanguage("রোজা ভাঙলে কী করতে হবে")).toBe("bangla");
  });

  it("detects romanized Banglish", () => {
    const banglish = [
      "namaz er niyom ki",
      "Quran and Hadis er sob free API integrate kora hoyeche?",
      "roja bhangle ki korte hobe",
      "ei masla ta kivabe bujhbo",
      "zakat kader upor forz hoy bolo",
    ];

    for (const question of banglish) {
      expect(detectQuestionLanguage(question), question).toBe("banglish");
    }
  });

  it("treats mixed Banglish with English tech words as Banglish", () => {
    expect(detectQuestionLanguage("sensitive files git ignore koro")).toBe("banglish");
  });

  it("leaves plain English alone", () => {
    const english = [
      "What are the conditions of prayer?",
      "Explain the ruling on interest in Islamic finance",
      "How does the retrieval pipeline rank sources?",
      "Can you summarize the hadith about intentions",
    ];

    for (const question of english) {
      expect(detectQuestionLanguage(question), question).toBe("other");
    }
  });

  it("returns other for empty input", () => {
    expect(detectQuestionLanguage("")).toBe("other");
    expect(detectQuestionLanguage("   ")).toBe("other");
  });

  it("shouldAnswerInBangla covers both Bangla and Banglish", () => {
    expect(shouldAnswerInBangla("নামাজ")).toBe(true);
    expect(shouldAnswerInBangla("namaz er niyom ki")).toBe(true);
    expect(shouldAnswerInBangla("What is the ruling on this?")).toBe(false);
  });
});

describe("masail-style questions in each language", () => {
  it("reads everyday Banglish masail as Banglish", () => {
    const banglish = [
      "Mohilara jore quran tilawat korle ki gunah hobe?",
      "Hayez er shomoy quran porte parbe?",
      "Musafir obosthay namaz kosor korte hoy kina",
      "Home loan niye bari kena jabe?",
      "Sud somporke islam ki bole",
    ];

    for (const question of banglish) {
      expect(detectQuestionLanguage(question), question).toBe("banglish");
    }
  });

  it("keeps English masail questions in English, even with Islamic terms", () => {
    const english = [
      "Can women recite the Quran loudly in front of non-mahram men?",
      "Is it haram to take a home loan with interest?",
      "What should a woman with irregular menstruation do about salah?",
      "How many rakats does a traveller pray for Zuhr?",
    ];

    for (const question of english) {
      expect(detectQuestionLanguage(question), question).toBe("other");
    }
  });

  it("answers a question mixing English and Bangla script in Bangla", () => {
    expect(detectQuestionLanguage("What is the hukum of নামাজ while travelling?")).toBe("bangla");
  });
});

describe("follow-ups from the screenshot", () => {
  it("recognises a long Banglish follow-up that only had one known marker before", () => {
    expect(
      detectQuestionLanguage("Shudhu hadiser reference dila but main hadis ta dila na keno?"),
    ).toBe("banglish");
  });

  it("keeps an ambiguous follow-up in Bangla when the conversation started in Bangla", () => {
    const question =
      "but why did you only give the reference, keno main text nai in this long answer here";

    expect(detectQuestionLanguage(question)).toBe("banglish");
    expect(
      detectConversationLanguage(
        "ok but the main text, tahole show the full reference list please",
        ["শেষ জামানায় কী হবে?"],
      ),
    ).toBe("banglish");
  });

  it("does not drag a genuinely English follow-up into Bangla", () => {
    expect(
      detectConversationLanguage("Can you show the full text of that hadith please?", [
        "শেষ জামানায় কী হবে?",
      ]),
    ).toBe("other");
  });
});
