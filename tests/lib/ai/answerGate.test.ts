import { describe, expect, it } from "vitest";
import { validateAnswer, type GateInput } from "@/lib/ai/answerGate";

const RLM = String.fromCharCode(0x200f);

const abuDawudArabic = `عَنْ عَبْدِ اللَّهِ بْنِ عَمْرٍو، أَنَّهُ ذَبَحَ شَاةً فَقَالَ أَهْدَيْتُمْ لِجَارِي الْيَهُودِيِّ فَإِنِّي سَمِعْتُ رَسُولَ اللَّهِ صلى الله عليه وسلم يَقُولُ ${RLM}"${RLM} مَا زَالَ جِبْرِيلُ يُوصِينِي بِالْجَارِ حَتَّى ظَنَنْتُ أَنَّهُ سَيُوَرِّثُهُ ${RLM}"${RLM}`;
const tirmidhiArabic = `عَنْ عَائِشَةَ، أَنَّ رَسُولَ اللَّهِ صلى الله عليه وسلم قَالَ ${RLM}"${RLM} مَا زَالَ جِبْرِيلُ يُوصِينِي بِالْجَارِ حَتَّى ظَنَنْتُ أَنَّهُ سَيُوَرِّثُهُ ${RLM}"${RLM}`;
const ayah =
  "يَمْحَقُ ٱللَّهُ ٱلرِّبَوٰا۟ وَيُرْبِى ٱلصَّدَقَٰتِ ۗ وَٱللَّهُ لَا يُحِبُّ كُلَّ كَفَّارٍ أَثِيمٍ";

const hadithInput: GateInput = {
  contextTexts: [
    `${abuDawudArabic}\n\nবাংলা: আব্দুল্লাহ ইবনু আমর (রাঃ) সূত্রে বর্ণিত।`,
    `${tirmidhiArabic}\n\nবাংলা: আইশা (রাঃ) হতে বর্ণিত আছে।`,
  ],
  references: ["সুনানে আবু দাউদ 5152", "জামে তিরমিযী 1942"],
  question: "প্রতিবেশীর হক সম্পর্কে হাদিসে কী আছে?",
  language: "bangla",
};

const quranInput: GateInput = {
  contextTexts: [`${ayah}\n\nবাংলা: আল্লাহ তা’আলা সুদকে নিশ্চিহ্ন করেন।`],
  references: ["Al-Baqara 2:276"],
  question: "সুদ সম্পর্কে কুরআন কী বলে?",
  language: "bangla",
};

describe("validateAnswer", () => {
  it("rejects the screenshot answer, whose Arabic was retyped without harakat", () => {
    const answer =
      "প্রতিবেশীর হক গুরুত্বপূর্ণ।\n\nএই হাদিসের মূল আরবি অংশটি হলো: ما زال جبريل يوصيني بالجار حتى ظننت أنه سيورثه\n\nবাংলায় এর অনুবাদ: জিবরীল (আঃ) অবিরত উপদেশ দিতেন। [1] [2]";

    const verdict = validateAnswer(answer, hadithInput);

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.some((reason) => reason.startsWith("arabic-not-verbatim"))).toBe(true);
  });

  it("passes an answer that quotes the narration exactly", () => {
    const answer = `নবীজি (সা.) বলেছেন:\n\nمَا زَالَ جِبْرِيلُ يُوصِينِي بِالْجَارِ حَتَّى ظَنَنْتُ أَنَّهُ سَيُوَرِّثُهُ\n\nঅর্থাৎ প্রতিবেশীর হক অত্যন্ত গুরুত্বপূর্ণ [1] [2]।`;

    expect(validateAnswer(answer, hadithInput)).toEqual({ ok: true, reasons: [] });
  });

  it("tolerates the invisible direction marks and quotes the model leaves out", () => {
    const answer = `عَنْ عَبْدِ اللَّهِ بْنِ عَمْرٍو، أَنَّهُ ذَبَحَ شَاةً فَقَالَ أَهْدَيْتُمْ لِجَارِي الْيَهُودِيِّ [1]`;

    expect(validateAnswer(answer, hadithInput).ok).toBe(true);
  });

  it("tolerates a surah header and a dropped pause mark around a faithful ayah", () => {
    const answer = `সূরা আল-বাকারার আয়াত:\n\nسورة البقرة، ٢:٢٧٦\nيَمْحَقُ ٱللَّهُ ٱلرِّبَوٰا۟ وَيُرْبِى ٱلصَّدَقَٰتِ وَٱللَّهُ لَا يُحِبُّ كُلَّ كَفَّارٍ أَثِيمٍ [1]`;

    expect(validateAnswer(answer, quranInput).ok).toBe(true);
  });

  it("treats harakat in a different but equivalent order as the same text", () => {
    const shaddaFirst = String.fromCharCode(0x0643, 0x064f, 0x0644, 0x0651, 0x064e);
    const fathaFirst = String.fromCharCode(0x0643, 0x064f, 0x0644, 0x064e, 0x0651);
    const source = `وَٱللَّهُ لَا يُحِبُّ ${shaddaFirst} كَفَّارٍ أَثِيمٍ`;
    const answer = `وَٱللَّهُ لَا يُحِبُّ ${fathaFirst} كَفَّارٍ أَثِيمٍ [1]`;

    expect(shaddaFirst).not.toBe(fathaFirst);
    expect(validateAnswer(answer, { ...quranInput, contextTexts: [source] }).ok).toBe(true);
  });

  it("does not treat an honorific as a misquotation", () => {
    const answer = "রাসূলুল্লাহ صلى الله عليه وسلم প্রতিবেশীর হকের কথা বলেছেন [1]।";

    expect(validateAnswer(answer, quranInput).ok).toBe(true);
  });

  it("rejects a citation number that points past the retrieved sources", () => {
    const verdict = validateAnswer("প্রতিবেশীর হক গুরুত্বপূর্ণ [3]।", hadithInput);

    expect(verdict.reasons).toContain("citation-out-of-range: 3");
  });

  it("rejects an answer that loops", () => {
    const answer = `প্রতিবেশীর হক গুরুত্বপূর্ণ [1]। হাদিসের অর্থ হলো, ${"এর অর্থ হলো, ".repeat(6)}এর অর্থ হলো।`;

    expect(validateAnswer(answer, hadithInput).reasons).toContain("repetition-loop");
  });

  it("rejects a word that fuses Bangla and Latin script", () => {
    const verdict = validateAnswer("এই আলোচনার সারাংsatজ হলো প্রতিবেশীর হক [1]।", hadithInput);

    expect(verdict.reasons.some((reason) => reason.startsWith("mixed-script-word"))).toBe(true);
  });

  it("rejects English leaking into a Bangla answer", () => {
    const verdict = validateAnswer(
      "Context অনুযায়ী এতে participating করা যাবে না [1]।",
      hadithInput,
    );

    expect(verdict.reasons.some((reason) => reason.startsWith("foreign-latin-words"))).toBe(true);
  });

  it("allows Latin surah names that the references themselves use", () => {
    const answer = "Al-Baqara সূরার এই আয়াতে সুদ নিষিদ্ধ করা হয়েছে [1]।";

    expect(validateAnswer(answer, quranInput).ok).toBe(true);
  });

  it("does not police Latin words when the question itself was in English", () => {
    const answer = "Allah destroys interest and gives increase for charities [1].";

    expect(validateAnswer(answer, { ...quranInput, language: "other" }).ok).toBe(true);
  });
});
