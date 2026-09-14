import { describe, expect, it } from "vitest";
import {
  attachOrphanCitations,
  completedSentencesEnd,
  dropUnsupportedClaims,
  isSourceSectionHeading,
  normalizeCitationDigits,
  isArabicDominant,
  isReferenceListLine,
  normalizeDashes,
  prepareAnswer,
  referenceEchoStart,
  separateArabicQuotes,
  splitMarkdownBlocks,
  stripReferenceEchoes,
  stripTrailingSources,
} from "@/lib/ai/answerText";

const body = "সুদ হারাম [1]। ব্যবসা হালাল [2]।";

describe("stripTrailingSources", () => {
  it("removes a bold Bangla source list", () => {
    const text = `${body}\n\n**সূত্র:**\n- [1] সূরা আল-বাকারা 2:275\n- [2] সহীহ বুখারী 2084`;
    expect(stripTrailingSources(text)).toBe(body);
  });

  it("removes a heading-style source list", () => {
    const text = `${body}\n\n### সূত্র\n1. সূরা আল-ইমরান ৩:১৩০ [3]\n2. সহীহ বুখারী ৭২৭৭ [5]`;
    expect(stripTrailingSources(text)).toBe(body);
  });

  it("removes an English sources list", () => {
    const text = `${body}\n\nSources:\n- [1] Al-Baqara 2:275`;
    expect(stripTrailingSources(text)).toBe(body);
  });

  it("removes a dangling heading with no list under it", () => {
    expect(stripTrailingSources(`${body}\n\n**সূত্র:**`)).toBe(body);
  });

  it("keeps inline citation markers untouched", () => {
    expect(stripTrailingSources(body)).toBe(body);
  });

  it("does not cut a body that merely mentions the word", () => {
    const text = "কথোপকথনের সূত্র ধরে বলছি, সুদ হারাম [1]।";
    expect(stripTrailingSources(text)).toBe(text);
  });
});

describe("normalizeDashes", () => {
  it("turns a spaced em-dash into a comma", () => {
    expect(normalizeDashes("সুদ হারাম — এটি কুরআনে স্পষ্ট।")).toBe("সুদ হারাম, এটি কুরআনে স্পষ্ট।");
  });

  it("keeps markdown list bullets as hyphens", () => {
    expect(normalizeDashes("তালিকা:\n— প্রথম\n— দ্বিতীয়")).toBe("তালিকা:\n- প্রথম\n- দ্বিতীয়");
  });

  it("tightens a dash used inside a compound", () => {
    expect(normalizeDashes("বাবা—মেয়ে")).toBe("বাবা-মেয়ে");
  });

  it("handles en-dashes the same way", () => {
    expect(normalizeDashes("ক – খ")).toBe("ক, খ");
  });

  it("leaves text without dashes alone", () => {
    expect(normalizeDashes("সুদ হারাম, এটি স্পষ্ট।")).toBe("সুদ হারাম, এটি স্পষ্ট।");
  });
});

const ayah = "مَا زَالَ جِبْرِيلُ يُوصِينِي بِالْجَارِ حَتَّى ظَنَنْتُ أَنَّهُ سَيُوَرِّثُهُ";

describe("isArabicDominant", () => {
  it("treats a quoted ayah or narration as an Arabic block", () => {
    expect(isArabicDominant(ayah)).toBe(true);
  });

  it("still treats it as Arabic with a citation marker attached", () => {
    expect(isArabicDominant(`${ayah} [1]`)).toBe(true);
  });

  it("tolerates a short Latin reference beside a long Arabic quote", () => {
    expect(isArabicDominant(`${ayah} ${ayah} (Al-Baqara 2:275)`)).toBe(true);
  });

  it("does not flip a Bangla sentence that introduces an Arabic quote, as in the screenshot", () => {
    const line = "এই হাদিসের মূল আরবি অংশটি হলো: ما زال جبريل يوصيني بالجار حتى ظننت أنه سيورثه";

    expect(isArabicDominant(line)).toBe(false);
  });

  it("does not flip an intro line even when the quote carries full harakat", () => {
    expect(isArabicDominant(`আল্লাহ বলেন: ${ayah}`)).toBe(false);
  });

  it("does not flip a translation line", () => {
    expect(
      isArabicDominant("বাংলা: জিবরীল (আঃ) অবিরত আমাকে প্রতিবেশীর হক সম্বন্ধে গুরুত্ব দিচ্ছিলেন।"),
    ).toBe(false);
  });

  it("never marks text without any Arabic", () => {
    expect(isArabicDominant("প্রতিবেশীর হক [1]")).toBe(false);
  });
});

describe("attachOrphanCitations", () => {
  const nl = String.fromCharCode(10);

  it("joins a paragraph that holds only a citation to the paragraph before it, as in the screenshot", () => {
    const text = `মূর্খতা বিস্তার পাবে।${nl}${nl}[1]`;

    expect(attachOrphanCitations(text)).toBe("মূর্খতা বিস্তার পাবে। [1]");
  });

  it("handles several markers and a dash before them", () => {
    const text = `সুদ হারাম।${nl}${nl}— [1], [2]${nl}${nl}পরের অনুচ্ছেদ।`;

    expect(attachOrphanCitations(text)).toBe(`সুদ হারাম। [1], [2]${nl}${nl}পরের অনুচ্ছেদ।`);
  });

  it("leaves markers that already sit inside a sentence alone", () => {
    const text = `সুদ হারাম [1]।${nl}${nl}ব্যবসা হালাল [2]।`;

    expect(attachOrphanCitations(text)).toBe(text);
  });

  it("runs as part of preparing an answer for display", () => {
    expect(prepareAnswer(`জ্ঞান উঠে যাবে।${nl}${nl}[1]`)).toBe("জ্ঞান উঠে যাবে। [1]");
  });
});

describe("neutralizeBackticks via prepareAnswer", () => {
  it("does not let a transliteration backtick turn hadith text into code", () => {
    const prepared = prepareAnswer(
      "English Meaning: Narrated Ibn `Abbas: The Prophet sent Mu`adh to Yemen",
    );
    expect(prepared).not.toContain("`");
    expect(prepared).toContain("Ibn \u2018Abbas");
  });
});

describe("splitMarkdownBlocks", () => {
  it("splits paragraphs on blank lines so finished blocks can be memoised", () => {
    expect(splitMarkdownBlocks("প্রথম অনুচ্ছেদ\n\n## শিরোনাম\n\n- এক\n- দুই")).toEqual([
      "প্রথম অনুচ্ছেদ",
      "## শিরোনাম",
      "- এক\n- দুই",
    ]);
  });

  it("never splits inside a fenced block or display math", () => {
    const text = "```\nএক\n\nদুই\n```\n\n$$\na\n\nb\n$$";
    expect(splitMarkdownBlocks(text)).toEqual(["```\nএক\n\nদুই\n```", "$$\na\n\nb\n$$"]);
  });

  it("rejoins to the same text apart from repeated blank lines", () => {
    const text = "ক\n\n\n\nখ";
    expect(splitMarkdownBlocks(text).join("\n\n")).toBe("ক\n\nখ");
  });
});

describe("separateArabicQuotes", () => {
  it("moves an ayah written after an intro colon into its own right-to-left paragraph", () => {
    const line =
      "আল্লাহ তা'আলা আরেক আয়াতে বলেন: يَمْحَقُ ٱللَّهُ ٱلرِّبَوٰا۟ وَيُرْبِى ٱلصَّدَقَٰتِ";
    const [intro, quote] = separateArabicQuotes(line).split("\n\n");

    expect(intro).toBe("আল্লাহ তা'আলা আরেক আয়াতে বলেন:");
    expect(isArabicDominant(quote ?? "")).toBe(true);
  });

  it("leaves label lines whose content is a translation alone", () => {
    const line = "বাংলা অর্থঃ আল্লাহ সুদকে নিশ্চিহ্ন করেন [2]";
    expect(separateArabicQuotes(line)).toBe(line);
  });

  it("leaves a short Arabic word inside a sentence alone", () => {
    const line = "এর অর্থ: الله মহান";
    expect(separateArabicQuotes(line)).toBe(line);
  });
});

describe("reference echoes and model-written reference lists", () => {
  it("removes the context header a model copies after or before a marker", () => {
    expect(stripReferenceEchoes("It is allowed [1] (Quran, An-Nur 24:31).")).toBe(
      "It is allowed [1].",
    );
    expect(stripReferenceEchoes("এটি জায়েজ (হাদিস, সহীহ বুখারী 1) [2]।")).toBe("এটি জায়েজ [2]।");
    expect(stripReferenceEchoes("এটি কি\u09AF\u09BCাসের নীতি [3] (কি\u09DFাস, আল-লুমা)।")).toBe(
      "এটি কি\u09AF\u09BCাসের নীতি [3]।",
    );
  });

  it("keeps ordinary parentheses in prose", () => {
    const prose = "Zakat is due on savings (above the nisab) [1].";
    expect(stripReferenceEchoes(prose)).toBe(prose);
  });

  it("recognises list lines, including ones that only repeat a known reference", () => {
    expect(isReferenceListLine("[1] (কুরআন, আল-আহযাব 33:59)")).toBe(true);
    expect(isReferenceListLine("**References:**")).toBe(true);
    expect(isReferenceListLine("- Al-Ahzaab 33:59 [1]", ["Al-Ahzaab 33:59"])).toBe(true);
    expect(isReferenceListLine("- Al-Ahzaab 33:59 [1]")).toBe(false);
    expect(
      isReferenceListLine("Al-Ahzaab 33:59 tells believing women to draw their cloaks [1].", [
        "Al-Ahzaab 33:59",
      ]),
    ).toBe(false);
  });

  it("prepareAnswer strips a list written in the middle of an answer", () => {
    const text =
      "হিজাব ফরজ [1]।\n\n[1] (কুরআন, আল-আহযাব 33:59)\n[2] (হাদিস, সহীহ বুখারী 146)\n\nব্যাখ্যা।";
    expect(prepareAnswer(text)).not.toContain("আল-আহযাব");
    expect(prepareAnswer(text)).toContain("ব্যাখ্যা।");
  });

  it("referenceEchoStart holds back a marker that may still get a copied header", () => {
    expect(referenceEchoStart("It is allowed [1] (Qur")).toBe(14);
    expect(referenceEchoStart("It is allowed.")).toBe(-1);
  });
});

describe("claims a model cannot back with a citation", () => {
  it("drops a consensus claim or a scholar attribution that cites nothing", () => {
    const text =
      "মহিলাদের জোরে তিলাওয়াত না করা উত্তম [2]। আলেমগণ একমত যে মহিলাদের স্বর নিচু রাখা উচিত। ইবনু রুশদ (রহ.) বিদায়াতুল মুজতাহিদে উল্লেখ করেছেন যে এটি মাকরূহ। বিস্তারিত জানতে মুফতির পরামর্শ নিন।";

    expect(dropUnsupportedClaims(text)).toBe(
      "মহিলাদের জোরে তিলাওয়াত না করা উত্তম [2]। বিস্তারিত জানতে মুফতির পরামর্শ নিন।",
    );
  });

  it("keeps the same claims when they carry a citation, and denials of consensus", () => {
    const cited = "ইবনুল মুনযির (রহ.) উল্লেখ করেছেন যে আলেমগণ একমত যে নামাজ ফরজ [3]।";
    const denial = "এ বিষয়ে আলেমদের কোনো ইজমা রয়েছে বলে প্রাপ্ত দলিলে পাওয়া যায়নি।";

    expect(dropUnsupportedClaims(cited)).toBe(cited);
    expect(dropUnsupportedClaims(denial)).toBe(denial);
    expect(
      dropUnsupportedClaims(
        "Scholars are agreed that it is disliked. It is allowed [1].",
      ).trimStart(),
    ).toBe("It is allowed [1].");
  });

  it("finds where the finished sentences end, keeping a citation written after the full stop", () => {
    expect(completedSentencesEnd("প্রথম কথা। [1] দ্বিতীয়")).toBe("প্রথম কথা। [1]".length);
    expect(completedSentencesEnd("ইমাম আবু হানীফা রহ. বলেন")).toBe(0);
    expect(completedSentencesEnd("It is allowed.")).toBe(0);
  });
});

describe("per-source headings", () => {
  it("recognises headings that sort evidence by source", () => {
    for (const heading of [
      "হাদিস থেকে দলিল:",
      "আলেমদের ঐকমত্য (ইজমা) থেকে দলিল:",
      "**ফিকহ থেকে দলিল**",
      "### কুরআনের দলিল",
      "Evidence from the Hadith:",
    ]) {
      expect(isSourceSectionHeading(heading), heading).toBe(true);
    }
  });

  it("leaves prose that mentions evidence alone", () => {
    expect(isSourceSectionHeading("হাদিসের দলিল অনুযায়ী এটি জায়েজ [1]।")).toBe(false);
    expect(isSourceSectionHeading("মূল কথা:")).toBe(false);
  });
});

describe("citations written with Bengali digits", () => {
  it("become ordinary citation numbers", () => {
    expect(normalizeCitationDigits("নীরব থাকুন। [\u09E9] আর [\u09E7\u09E8]")).toBe(
      "নীরব থাকুন। [3] আর [12]",
    );
    expect(normalizeCitationDigits("১২টি রাকাত")).toBe("১২টি রাকাত");
  });

  it("count as citations for a consensus claim", () => {
    const text = "আলেমগণ এ বিষয়ে একমত। [\u09EC] ব্যাখ্যা।";
    expect(dropUnsupportedClaims(normalizeCitationDigits(text))).toBe(
      "আলেমগণ এ বিষয়ে একমত। [6] ব্যাখ্যা।",
    );
    expect(dropUnsupportedClaims("চার মাযহাবের আলেমগণ এ বিষয়ে একমত। ব্যাখ্যা।")).toBe(
      " ব্যাখ্যা।",
    );
  });
});

describe("numbered markdown headings per source", () => {
  it("recognises them", () => {
    for (const heading of [
      "### ১. হাদিস সমর্থিত বিধান",
      "### ২. ইজমা (আলেমদের ঐকমত্য)",
      "### ৩. ফিকহ (মাযহাবী বিধান)",
      "## Quran",
    ]) {
      expect(isSourceSectionHeading(heading), heading).toBe(true);
    }
    expect(isSourceSectionHeading("### সফরের দূরত্ব ও মেয়াদ")).toBe(false);
  });
});
