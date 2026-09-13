import { describe, expect, it } from "vitest";
import {
  attachOrphanCitations,
  isArabicDominant,
  normalizeDashes,
  prepareAnswer,
  separateArabicQuotes,
  splitMarkdownBlocks,
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
