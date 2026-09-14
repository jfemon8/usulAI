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

const RLM = String.fromCharCode(0x200f);
const bukhari7066: EnrichmentSource = {
  index: 1,
  reference: "সহীহ বুখারী 7066",
  arabic: `حَدَّثَنَا مُحَمَّدٌ، حَدَّثَنَا غُنْدَرٌ، عَنْ عَبْدِ اللَّهِ، قَالَ ${RLM}"${RLM} بَيْنَ يَدَىِ السَّاعَةِ أَيَّامُ الْهَرْجِ، يَزُولُ الْعِلْمُ، وَيَظْهَرُ فِيهَا الْجَهْلُ ${RLM}"${RLM}\u200F.`,
  bangla: "কিয়ামতের আগে হারজ অর্থাৎ হত্যার যুগ শুরু হবে। তখন ইল্ম বিলুপ্ত হয়ে যাবে।",
  english: "Near the establishment of the Hour, there will be the days of Al-Harj.",
};

describe("evidence the model cited but never quoted", () => {
  const screenshotAnswer =
    "শেষ জামানায় ধর্মীয় জ্ঞান বিলুপ্ত হবে এবং মূর্খতা বিস্তার পাবে।\n\n[1]";
  const options: EnricherOptions = { sources: [bukhari7066], language: "bangla" };

  it("appends the cited hadith itself when the answer only gave its number, as in the screenshot", () => {
    const output = enrichAnswer(screenshotAnswer, options);

    expect(output).toContain("**দলিল [1]: সহীহ বুখারী 7066**");
    expect(output).toContain("بَيْنَ يَدَىِ السَّاعَةِ أَيَّامُ الْهَرْجِ");
    expect(output).toContain("**বাংলা উচ্চারণঃ** বাইনা ইয়াদায়িস সাআতি আয়্যামুল হারজি");
    expect(output).toContain(`**বাংলা অর্থঃ** ${bukhari7066.bangla} [1]`);
    expect(output).toContain(`**English Meaning:** ${bukhari7066.english} [1]`);
  });

  it("shows the Prophet's words without the chain of narrators", () => {
    const output = enrichAnswer(screenshotAnswer, options);

    expect(output).not.toContain("حَدَّثَنَا");
  });

  it("keeps the answer first and the evidence after it", () => {
    const output = enrichAnswer(screenshotAnswer, options);

    expect(output.indexOf("মূর্খতা বিস্তার পাবে")).toBeLessThan(output.indexOf("দলিল [1]"));
  });

  it("adds nothing when the answer already quoted that source", () => {
    const answer = `জ্ঞান উঠে যাবে [1]।\n\nبَيْنَ يَدَىِ السَّاعَةِ أَيَّامُ الْهَرْجِ، يَزُولُ الْعِلْمُ\n\nব্যাখ্যা।`;

    expect(enrichAnswer(answer, options)).not.toContain("দলিল [1]");
  });

  it("adds nothing for a source the answer never cited", () => {
    expect(enrichAnswer("জ্ঞান উঠে যাবে।", options)).not.toContain("দলিল");
  });

  it("labels the evidence in English for an English question", () => {
    const output = enrichAnswer("Knowledge will vanish [1].", { ...options, language: "other" });

    expect(output).toContain("**Evidence [1]: সহীহ বুখারী 7066**");
    expect(output).toContain("**English Pronunciation:** bayna yadayis saa'ati");
    expect(output).not.toContain("বাংলা অর্থঃ");
  });

  it("streams to the same result as enriching the whole answer", () => {
    expect(streamWords(screenshotAnswer, options)).toBe(enrichAnswer(screenshotAnswer, options));
  });
});

describe("pronouncing a hadith quoted with its chain of narrators", () => {
  it("reads only the Prophet's words, not the whole isnad", () => {
    const quotedWithChain = bukhari7066.arabic;
    const output = enrichAnswer(`${quotedWithChain}\n\nব্যাখ্যা [1]।`, {
      sources: [bukhari7066],
      language: "bangla",
    });

    expect(output).toContain("**বাংলা উচ্চারণঃ** বাইনা ইয়াদায়িস সাআতি");
    expect(output).not.toContain("হাদ্দাছানা");
  });

  it("reads the quoted words as they are when the model already quoted only the matn", () => {
    const output = enrichAnswer("بَيْنَ يَدَىِ السَّاعَةِ أَيَّامُ الْهَرْجِ\n\nব্যাখ্যা।", {
      sources: [bukhari7066],
      language: "bangla",
    });

    expect(output).toContain("**বাংলা উচ্চারণঃ** বাইনা ইয়াদায়িস সাআতি আয়্যামুল হারজ");
  });
});

describe("ijma sources with a machine translation", () => {
  const firstPlain = "أجمع أهل العلم على أن الصلاة لا تجزئ إلا بطهارة";
  const firstVocalized =
    "أَجْمَعَ أَهْلُ الْعِلْمِ عَلَى أَنَّ الصَّلَاةَ لَا تُجْزِئُ إِلَّا بِطَهَارَةٍ";
  const secondPlain = "وأجمعوا على أن خروج الغائط من الدبر ينقض الطهارة";
  const ijma: EnrichmentSource = {
    index: 3,
    arabic: `${firstVocalized}
${secondPlain}`,
    bangla:
      "আলেমগণ একমত যে পবিত্রতা ছাড়া নামাজ যথেষ্ট হয় না। তাঁরা একমত যে পায়খানা বের হলে পবিত্রতা নষ্ট হয়।",
    english: "Prayer is not valid without purification. Passing stool breaks purification.",
    machineTranslated: true,
    segments: [
      {
        arabic: firstPlain,
        bangla: "আলেমগণ একমত যে পবিত্রতা ছাড়া নামাজ যথেষ্ট হয় না।",
        english: "The scholars agree that prayer is not valid without purification.",
      },
      {
        arabic: secondPlain,
        bangla: "তাঁরা একমত যে পায়খানা বের হলে পবিত্রতা নষ্ট হয়।",
        english: "They agree that passing stool breaks purification.",
      },
    ],
  };

  it("shows pronunciation and only the quoted mas'ala's meaning, marked as AI translation", () => {
    const enriched = enrichAnswer(
      `ইবনুল মুনযির লিখেছেন [3]।

${firstPlain}

অর্থাৎ অজু ছাড়া নামাজ হয় না।`,
      { sources: [ijma], language: "bangla" },
    );

    expect(enriched).toContain("**বাংলা উচ্চারণঃ**");
    expect(enriched).toContain(
      "**বাংলা অর্থঃ** আলেমগণ একমত যে পবিত্রতা ছাড়া নামাজ যথেষ্ট হয় না। [3] *(AI অনুবাদ)*",
    );
    expect(enriched).not.toContain("পায়খানা");
    expect(enriched).toContain("[3] *(AI translation)*");
  });

  it("never appends a book passage as cited-but-unquoted evidence", () => {
    const enriched = enrichAnswer("আলেমগণ এ বিষয়ে একমত [3]।", {
      sources: [ijma],
      language: "bangla",
    });

    expect(enriched).not.toContain("দলিল [3]");
  });
});

describe("pronunciation needs harakat", () => {
  it("does not invent a pronunciation for an unvocalised book quote that has no vocalised source", () => {
    const plain = "واتفق أهل القبلة جميعا على أن الخمر حرام بتحريم الله تعالى إياها";
    const enriched = enrichAnswer(
      `ইবনুল কাত্তান উল্লেখ করেছেন [1]।\n\n${plain}\n\nঅর্থাৎ মদ হারাম।`,
      {
        sources: [{ index: 1, arabic: plain }],
        language: "bangla",
      },
    );

    expect(enriched).not.toContain("বাংলা উচ্চারণঃ");
  });
});

describe("strict mode for answers that stream straight to the reader", () => {
  const strictOptions: EnricherOptions = { sources: [quran], language: "bangla", strict: true };
  const invented = "يَا أَيُّهَا الَّذِينَ آمَنُوا لَا تَدْخُلُوا بُيُوتًا غَيْرَ بُيُوتِكُمْ";
  const screenshot = `সুদ কুরআনে নিষিদ্ধ [1]।

${ayah}

এছাড়াও আরেকটি আয়াতে বলা হয়েছে:

${invented}

এই আয়াতটি অনুমতি নেওয়ার কথা বলে [2]। আরেকটি নির্দেশ আছে [3]।`;

  it("leaves out an Arabic quotation that no source contains, with its pronunciation", () => {
    const output = enrichAnswer(screenshot, strictOptions);

    expect(output).not.toContain("تَدْخُلُوا");
    expect(output).toContain("দেওয়া দলিলে পাওয়া যায়নি এমন একটি আরবি উদ্ধৃতি");
    expect(output.match(/বাংলা উচ্চারণঃ/g)).toHaveLength(1);
    expect(output).toContain(`**বাংলা অর্থঃ** ${quran.bangla} [1]`);
  });

  it("removes citation numbers that point past the sources", () => {
    const output = enrichAnswer(screenshot, strictOptions);

    expect(output).toContain("অনুমতি নেওয়ার কথা বলে।");
    expect(output).toContain("আরেকটি নির্দেশ আছে।");
    expect(output).not.toMatch(/\[[23]\]/);
    expect(output).toContain("নিষিদ্ধ [1]।");
  });

  it("streams word by word to exactly the same text", () => {
    expect(streamWords(screenshot, strictOptions)).toBe(enrichAnswer(screenshot, strictOptions));
  });

  it("streams whole sentences and holds back the one still being written", () => {
    const enricher = createQuoteEnricher(strictOptions);

    expect(enricher.push("প্রতিবেশীর হক ")).toBe("");
    expect(enricher.push("অত্যন্ত [")).toBe("");
    expect(enricher.push("2]। ")).toBe("প্রতিবেশীর হক অত্যন্ত।");
  });

  it("keeps a quotation that is in the sources and Arabic chapter names from the references", () => {
    const withReference: EnricherOptions = {
      ...strictOptions,
      sources: [{ ...quran, reference: "আল-ইকনা, ذكر فرض الحج وكم فرضه, খণ্ড 1" }],
    };
    const output = enrichAnswer(
      `${ayah} [1]\n\nকিতাবের অধ্যায় ذكر فرض الحج وكم فرضه [1]।`,
      withReference,
    );

    expect(output).toContain(ayah);
    expect(output).toContain("ذكر فرض الحج وكم فرضه");
    expect(output).not.toContain("দেখানো হয়নি");
  });
});

describe("strict mode for an English answer that echoes its references", () => {
  const nur: EnrichmentSource = { ...quran, index: 1, reference: "An-Nur 24:31" };
  const hadith: EnrichmentSource = { ...abuDawud, index: 2, reference: "Sunan Abi Dawud 5152" };
  const options: EnricherOptions = { sources: [nur, hadith], language: "other", strict: true };
  const echoed = `Muslim women may recite the Quran, but scholars say a woman should not raise her voice before non-mahram Men [1] (Quran, An-Nur 24:31).

[1] (Quran, An-Nur 24:31)
[2] (Hadith, Sunan Abi Dawud 5152)

Sources:
- An-Nur 24:31 [1]

Most Muslim scholars agree on this.`;

  it("keeps capital letters that the foreign-script filter used to delete", () => {
    const output = enrichAnswer(echoed, options);

    expect(output).toContain("Muslim women");
    expect(output).toContain("non-mahram Men");
    expect(output).toContain("Most Muslim scholars");
  });

  it("drops the echoed reference after a marker and every reference list line", () => {
    const output = enrichAnswer(echoed, options);

    expect(output).toContain("non-mahram Men [1].");
    expect(output).not.toContain("(Quran, An-Nur 24:31)");
    expect(output).not.toContain("Sunan Abi Dawud 5152");
    expect(output).not.toContain("Sources:");
    expect(output).not.toContain("- An-Nur 24:31 [1]");
  });

  it("does not append evidence for a number cited only inside a dropped list", () => {
    expect(enrichAnswer(echoed, options)).not.toContain("Evidence [2]");
  });

  it("streams word by word to exactly the same text", () => {
    expect(streamWords(echoed, options)).toBe(enrichAnswer(echoed, options));
  });

  it("drops a paragraph the model repeats word for word", () => {
    const paragraph =
      "A woman may recite the Quran quietly when non-mahram men can hear her voice [1].";
    const output = enrichAnswer(`${paragraph}\n\n${paragraph}\n\nEnd.`, options);

    expect(output.split(paragraph)).toHaveLength(2);
    expect(output).toContain("End.");
  });

  it("strips letters and marks from scripts no source uses", () => {
    const output = enrichAnswer("নামাজের কল\u0947্যাণ [1]।", {
      ...options,
      language: "bangla",
    });

    expect(output).not.toContain("\u0947");
  });
});

describe("strict mode against a model that retells what the app already added", () => {
  const options: EnricherOptions = { sources: [quran], language: "bangla", strict: true };
  const retold = `সুদের বরকত নেই [1]।

${ayah}

আল্লাহ তা’আলা সুদকে নিশ্চিহ্ন করেন এবং দান খয়রাতকে বর্ধিত করেন। [1]

হাদিস থেকে দলিল:

এই আয়াতে বলা হয়েছে যে সুদের বরকত থাকে না [1]। আলেমগণ একমত যে সুদ সব অবস্থায় হারাম।`;

  it("shows the meaning once, under the quote", () => {
    const output = enrichAnswer(retold, options);
    expect(output.split("দান খয়রাতকে বর্ধিত করেন")).toHaveLength(2);
    expect(output).toContain(`**বাংলা অর্থঃ** ${quran.bangla} [1]`);
  });

  it("drops the per-source heading and the consensus it cannot cite", () => {
    const output = enrichAnswer(retold, options);
    expect(output).not.toContain("হাদিস থেকে দলিল");
    expect(output).not.toContain("আলেমগণ একমত");
    expect(output).toContain("সুদের বরকত থাকে না [1]।");
  });

  it("streams word by word to exactly the same text", () => {
    expect(streamWords(retold, options)).toBe(enrichAnswer(retold, options));
  });
});
