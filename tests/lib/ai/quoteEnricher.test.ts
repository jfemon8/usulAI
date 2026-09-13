import { describe, expect, it } from "vitest";
import {
  createQuoteEnricher,
  enrichAnswer,
  type EnricherOptions,
  type EnrichmentSource,
} from "@/lib/ai/quoteEnricher";
import ayahs from "../../fixtures/uthmaniAyahs.json";

const ayah = ayahs["2:276"];
const matn = "مَا زَالَ جِبْرِيلُ يُوصِينِي بِالْجَارِ حَتَّى ظَنَنْتُ أَنَّهُ سَيُوَرِّثُهُ";

const quran: EnrichmentSource = {
  index: 1,
  arabic: ayah,
  bangla: "আল্লাহ তা’আলা সুদকে নিশ্চিহ্ন করেন এবং দান খয়রাতকে বর্ধিত করেন।",
  english: "Allah destroys interest and gives increase for charities.",
};

const abuDawud: EnrichmentSource = {
  index: 1,
  arabic: `عَنْ عَبْدِ اللَّهِ بْنِ عَمْرٍو، أَنَّهُ ذَبَحَ شَاةً فَقَالَ ${matn}`,
  bangla: "আব্দুল্লাহ ইবনু আমর (রাঃ) সূত্রে বর্ণিত। তিনি একটি বকরী যবাহ করলেন।",
  english: "Abdullah ibn Amr slaughtered a sheep.",
};

const tirmidhi: EnrichmentSource = {
  index: 2,
  arabic: `عَنْ عَائِشَةَ، أَنَّ رَسُولَ اللَّهِ صلى الله عليه وسلم قَالَ ${matn}`,
  bangla: "আইশা (রাঃ) হতে বর্ণিত আছে।",
  english: "Aishah narrated.",
};

const banglaOptions: EnricherOptions = { sources: [quran], language: "bangla" };

const answer = `সুদ কুরআনে নিষিদ্ধ [1]।

${ayah} [1]

বাংলা: আল্লাহ তা’আলা সুদকে নিশ্চিহ্ন করেন [1]।

এই আয়াতে বলা হয়েছে যে সুদের বরকত থাকে না।`;

function streamWords(text: string, options: EnricherOptions) {
  const enricher = createQuoteEnricher(options);
  const pieces = text.match(/\S+\s*|\s+/g) ?? [];
  return pieces.map((piece) => enricher.push(piece)).join("") + enricher.flush();
}

describe("enrichAnswer for a Bangla question", () => {
  const output = enrichAnswer(answer, banglaOptions);

  it("adds the Bangla pronunciation, Bangla meaning and English meaning under the quote", () => {
    expect(output).toContain("**বাংলা উচ্চারণঃ** ইয়ামহাকুল লাহুর রিবা");
    expect(output).toContain(`**বাংলা অর্থঃ** ${quran.bangla} [1]`);
    expect(output).toContain(`**English Meaning:** ${quran.english} [1]`);
  });

  it("places them in that order, right after the Arabic and before the explanation", () => {
    const positions = [
      output.indexOf(ayah),
      output.indexOf("বাংলা উচ্চারণঃ"),
      output.indexOf("বাংলা অর্থঃ"),
      output.indexOf("English Meaning:"),
      output.indexOf("এই আয়াতে বলা হয়েছে"),
    ];

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("drops the translation the model wrote itself so it does not appear twice", () => {
    expect(output).not.toContain("বাংলা: আল্লাহ");
  });

  it("keeps the rest of the answer intact", () => {
    expect(output.startsWith("সুদ কুরআনে নিষিদ্ধ [1]।")).toBe(true);
    expect(output.trimEnd().endsWith("এই আয়াতে বলা হয়েছে যে সুদের বরকত থাকে না।")).toBe(true);
  });
});

describe("enrichAnswer for an English question", () => {
  const output = enrichAnswer(
    `Interest is forbidden [1].\n\n${ayah} [1]\n\nIt means charity grows.`,
    {
      sources: [quran],
      language: "other",
    },
  );

  it("adds the English pronunciation and meaning only", () => {
    expect(output).toContain("**English Pronunciation:** yamhaqul laahur ribaa");
    expect(output).toContain(`**English Meaning:** ${quran.english} [1]`);
    expect(output).not.toContain("বাংলা");
  });
});

describe("createQuoteEnricher while streaming", () => {
  it("produces exactly what the whole-text path produces", () => {
    expect(streamWords(answer, banglaOptions)).toBe(enrichAnswer(answer, banglaOptions));
  });

  it("streams ordinary prose immediately instead of waiting for the line to end", () => {
    const enricher = createQuoteEnricher(banglaOptions);

    expect(enricher.push("প্রতিবেশীর হক ")).toBe("প্রতিবেশীর হক ");
    expect(enricher.push("অত্যন্ত ")).toBe("অত্যন্ত ");
  });

  it("does not hold back prose that merely starts like a label", () => {
    const enricher = createQuoteEnricher(banglaOptions);
    const first = enricher.push("অর্থাৎ ");

    expect(first).toBe("অর্থাৎ ");
  });

  it("adds the block when the answer ends on a quote with no trailing newline", () => {
    const enricher = createQuoteEnricher(banglaOptions);
    const output = enricher.push(`দলিল:\n\n${ayah}`) + enricher.flush();

    expect(output).toContain("**বাংলা উচ্চারণঃ**");
  });
});

describe("matching a quote to its source", () => {
  it("gives both narrations' meanings when two sources share the quoted words", () => {
    const output = enrichAnswer(`${matn} [1] [2]\n\nব্যাখ্যা।`, {
      sources: [abuDawud, tirmidhi],
      language: "bangla",
    });

    expect(output).toContain(`${abuDawud.bangla} [1] ${tirmidhi.bangla} [2]`);
  });

  it("reads an unvocalised quote from the vocalised source it came from", () => {
    const output = enrichAnswer("ما زال جبريل يوصيني بالجار حتى ظننت أنه سيورثه\n\nব্যাখ্যা।", {
      sources: [abuDawud],
      language: "bangla",
    });

    expect(output).toContain("**বাংলা উচ্চারণঃ** মা যালা জিবরীলু");
    expect(output).toContain(`**বাংলা অর্থঃ** ${abuDawud.bangla} [1]`);
  });

  it("still gives a pronunciation for vocalised Arabic that is not in the sources, but no meaning", () => {
    const output = enrichAnswer(`${matn}\n\nব্যাখ্যা।`, { sources: [quran], language: "bangla" });

    expect(output).toContain("**বাংলা উচ্চারণঃ**");
    expect(output).not.toContain("বাংলা অর্থঃ");
  });

  it("adds nothing for unvocalised Arabic it cannot place, rather than guessing", () => {
    const output = enrichAnswer("ما زال جبريل يوصيني بالجار\n\nব্যাখ্যা।", {
      sources: [quran],
      language: "bangla",
    });

    expect(output).not.toContain("উচ্চারণঃ");
  });

  it("ignores a two-word surah header", () => {
    const output = enrichAnswer("سورة البقرة\n\nব্যাখ্যা।", banglaOptions);

    expect(output).toBe("سورة البقرة\n\nব্যাখ্যা।");
  });
});

describe("layout", () => {
  it("enriches a Bangla line that introduces an Arabic quote", () => {
    const output = enrichAnswer(`এই হাদিসের মূল আরবি অংশটি হলো: ${matn}\n\nব্যাখ্যা।`, {
      sources: [abuDawud],
      language: "bangla",
    });

    expect(output.indexOf("বাংলা উচ্চারণঃ")).toBeGreaterThan(output.indexOf(matn));
  });

  it("separates the block from a blockquoted ayah so markdown cannot merge them", () => {
    const output = enrichAnswer(`> ${ayah}\nব্যাখ্যা।`, banglaOptions);

    expect(output).toContain("\n\n**বাংলা উচ্চারণঃ**");
  });

  it.each([
    "**বাংলা অনুবাদ:** যারা সুদ খায়",
    "English: Allah destroys interest",
    "উচ্চারণঃ ইয়ামহাকুল",
    "- বাংলা অর্থ: আল্লাহ সুদকে",
  ])("drops a model-written label line: %s", (labelLine) => {
    const output = enrichAnswer(`${ayah}\n\n${labelLine}\n\nব্যাখ্যা।`, banglaOptions);

    expect(output).not.toContain(labelLine);
  });
});
