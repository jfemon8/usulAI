import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/ai/auxiliaryModel", () => ({ generateWithPreferredModels: vi.fn() }));

const {
  englishTranslationKey,
  mergeVocalization,
  parseEnglishTranslation,
  passageKind,
  passageTranslationKey,
  needsTranslation,
  parseTranslation,
  splitPassage,
  translationKey,
  withTranslation,
} = await import("@/lib/ai/sourceTranslation");

const first = "1 - أجمع أهل العلم على أن الصلاة لا تجزئ إلا بطهارة إذا وجد المرء إليها السبيل.";
const second = "2 - وأجمعوا على أن خروج الغائط من الدبر وخروج البول من الذكر ينقض الطهارة.";
const firstVocalized =
  "1 - أَجْمَعَ أَهْلُ الْعِلْمِ عَلَى أَنَّ الصَّلَاةَ لَا تُجْزِئُ إِلَّا بِطَهَارَةٍ إِذَا وَجَدَ الْمَرْءُ إِلَيْهَا السَّبِيلَ.";
const bangla =
  "১ - আলেমগণ একমত যে পবিত্রতা অর্জনের উপায় থাকলে পবিত্রতা ছাড়া নামাজ যথেষ্ট হয় না।";
const english =
  "1 - The scholars agree that prayer is not valid without purification when it is possible.";
const bangla2 = "২ - তাঁরা একমত যে পায়খানা ও পেশাব বের হওয়া পবিত্রতা নষ্ট করে।";
const english2 = "2 - They agree that passing stool or urine breaks purification.";

function reply(items: unknown[]): string {
  return `\`\`\`json\n${JSON.stringify(items)}\n\`\`\``;
}

describe("splitPassage", () => {
  it("splits a book passage at its numbered masail", () => {
    expect(splitPassage(`${first} ${second}`)).toEqual([first, second]);
  });

  it("folds a short heading line into the passage that follows it", () => {
    const segments = splitPassage(`بسم الله الرحمن الرحيم\n${first}`);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.startsWith("بسم الله")).toBe(true);
  });
});

describe("parseTranslation", () => {
  const segments = [first, second];

  it("returns one translated segment per Arabic segment, in order", () => {
    const parsed = parseTranslation(
      reply([
        { vocalized: firstVocalized, bangla, english },
        { bangla: bangla2, english: english2 },
      ]),
      segments,
    );

    expect(parsed?.segments.map((segment) => segment.arabic)).toEqual(segments);
    expect(parsed?.segments[0]?.vocalized).toBe(firstVocalized);
    expect(parsed?.segments[1]?.vocalized).toBeUndefined();
  });

  it("rejects a reply whose number of segments does not match", () => {
    expect(parseTranslation(reply([{ bangla, english }]), segments)).toBeNull();
  });

  it("rejects a Bangla field that is not actually Bangla", () => {
    expect(
      parseTranslation(
        reply([
          { bangla: english, english },
          { bangla: bangla2, english: english2 },
        ]),
        segments,
      ),
    ).toBeNull();
  });

  it("rejects letters from an unrelated script and Bangla words fused with Latin", () => {
    const withChinese = [
      { bangla: `${bangla} 下面`, english },
      { bangla: bangla2, english: english2 },
    ];
    const fused = [
      { bangla: `${bangla} পবিত্রতাwudu`, english },
      { bangla: bangla2, english: english2 },
    ];

    expect(parseTranslation(reply(withChinese), segments)).toBeNull();
    expect(parseTranslation(reply(fused), segments)).toBeNull();
  });

  it("reads the reply even when the model left raw line breaks inside strings", () => {
    const lineBreak = String.fromCharCode(10);
    const raw = `[{"bangla": "${bangla}${lineBreak}", "english": "${english}"}, {"bangla": "${bangla2}", "english": "${english2}"}]`;

    expect(() => JSON.parse(raw)).toThrow();
    expect(parseTranslation(raw, segments)?.segments[0]?.bangla).toBe(bangla);
  });

  it("removes long dashes", () => {
    const parsed = parseTranslation(
      reply([
        { bangla: `${bangla}—এটাই ইজমা`, english },
        { bangla: bangla2, english: english2 },
      ]),
      segments,
    );
    expect(parsed?.segments[0]?.bangla).not.toContain("—");
  });
});

describe("mergeVocalization", () => {
  it("takes harakat only for words whose letters the model left unchanged", () => {
    const altered = firstVocalized.replace("بِطَهَارَةٍ", "بِوُضُوءٍ");
    const merged = mergeVocalization(first, altered);

    expect(merged).toContain(" بطهارة ");
    expect(merged?.startsWith("1 - أَجْمَعَ")).toBe(true);
  });

  it("gives up when too few words survive", () => {
    expect(
      mergeVocalization(first, "قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ"),
    ).toBeUndefined();
  });
});

describe("attaching a translation", () => {
  const chunk = {
    id: "1",
    sourceType: "ijma" as const,
    content: `${first}\n${second}`,
    citation: { sourceType: "ijma" as const, reference: "কিতাবুল ইজমা, পৃষ্ঠা 41" },
    similarity: 5,
    retrievedBy: "text" as const,
  };
  const translation = {
    segments: [
      { arabic: first, vocalized: firstVocalized, bangla, english },
      { arabic: second, bangla: bangla2, english: english2 },
    ],
  };

  it("only translates book sources that have no translation yet", () => {
    expect(needsTranslation(chunk)).toBe(true);
    expect(needsTranslation({ ...chunk, sourceType: "hadith" })).toBe(false);
    expect(
      needsTranslation({
        ...chunk,
        sourceType: "sirat",
        content: "রাসূলুল্লাহ সাল্লাল্লাহু আলাইহি ওয়াসাল্লাম মদীনার পথে রওনা হলেন।",
      }),
    ).toBe(false);
    expect(needsTranslation(withTranslation(chunk, translation))).toBe(false);
  });

  it("keeps the original Arabic first and exposes segments and vocalised text", () => {
    const translated = withTranslation(chunk, translation);

    expect(translated.content.startsWith(first)).toBe(true);
    expect(translated.content).toContain(`বাংলা: ${bangla} ${bangla2}`);
    expect(translated.vocalized).toBe(`${firstVocalized}\n${second}`);
    expect(translated.segments).toHaveLength(2);
    expect(translated.machineTranslated).toBe(true);
  });

  it("keys the cache on the text regardless of spacing", () => {
    expect(translationKey(`${first}  `)).toBe(translationKey(first));
  });
});

describe("translating at response time", () => {
  it("translates each missing passage once even when two requests need it together", async () => {
    vi.resetModules();
    const translateCalls: string[] = [];
    vi.doMock("@/lib/ai/auxiliaryModel", () => ({
      generateWithPreferredModels: vi.fn(async (_purpose: string, options: { prompt: string }) => {
        translateCalls.push(options.prompt);
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          modelId: "glm-4.5-flash",
          text: JSON.stringify([
            { bangla, english },
            { bangla: bangla2, english: english2 },
          ]),
        };
      }),
    }));
    vi.doMock("@/lib/db/mongoClient", () => ({
      getDb: async () => ({ collection: () => ({ replaceOne: async () => ({}) }) }),
    }));

    const translation = await import("@/lib/ai/sourceTranslation");
    const chunk = {
      id: "p41",
      sourceType: "ijma" as const,
      content: `${first}\n${second}`,
      citation: { sourceType: "ijma" as const, reference: "কিতাবুল ইজমা, পৃষ্ঠা 41" },
      similarity: 5,
      retrievedBy: "text" as const,
    };

    const one = translation.startMissingTranslations([chunk]);
    const two = translation.startMissingTranslations([chunk]);
    await translation.settleWithin([...one.jobs, ...two.jobs], 1000);

    expect(translateCalls).toHaveLength(1);
    expect(one.results.get("p41")?.segments).toHaveLength(2);
    expect(two.results.get("p41")?.segments).toHaveLength(2);
  });

  it("stops waiting after the limit so the answer is never held up for long", async () => {
    const { settleWithin } = await import("@/lib/ai/sourceTranslation");
    const started = Date.now();
    await settleWithin([new Promise(() => {})], 30);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("skips translating book sources that already carry a translation", async () => {
    const { startMissingTranslations, withTranslation } =
      await import("@/lib/ai/sourceTranslation");
    const chunk = {
      id: "done",
      sourceType: "ijma" as const,
      content: first,
      citation: { sourceType: "ijma" as const, reference: "কিতাবুল ইজমা, পৃষ্ঠা 41" },
      similarity: 5,
      retrievedBy: "text" as const,
    };
    const translated = withTranslation(chunk, { segments: [{ arabic: first, bangla, english }] });

    expect(startMissingTranslations([translated]).jobs).toHaveLength(0);
  });
});

describe("English book passages", () => {
  const english =
    "In the thirteenth year of his mission the Prophet left Mecca by night with Abu Bakr and hid in the cave of Thaur for three days.";

  it("tells Arabic, English and Bangla passages apart", () => {
    expect(passageKind(first)).toBe("arabic");
    expect(passageKind(english)).toBe("english");
    expect(passageKind("নবী (সা.) আবু বকরকে নিয়ে রাতে মক্কা ত্যাগ করেন।")).toBeNull();
  });

  it("keys English translations apart from Arabic ones and ignores whitespace", () => {
    expect(passageTranslationKey(english, "english")).toBe(englishTranslationKey(`  ${english}\n`));
    expect(passageTranslationKey(english, "english")).toMatch(/^en:[0-9a-f]{64}$/);
    expect(passageTranslationKey(first, "arabic")).toBe(translationKey(first));
  });

  it("accepts a clean Bangla translation and keeps the English original", () => {
    const parsed = parseEnglishTranslation(
      "নবুওয়াতের তেরোতম বছরে নবী রাতের বেলা আবু বকরকে নিয়ে মক্কা ত্যাগ করেন এবং তিন দিন সাওর গুহায় লুকিয়ে থাকেন।",
      english,
    );

    expect(parsed?.segments).toHaveLength(1);
    expect(parsed?.segments[0]?.english).toBe(english);
    expect(parsed?.segments[0]?.bangla).toContain("সাওর গুহায়");
  });

  it("rejects a reply that is not Bangla or fuses scripts inside a word", () => {
    expect(parseEnglishTranslation(english, english)).toBeNull();
    expect(
      parseEnglishTranslation("নবী রাতের বেলা মক্কাtyag করেন এবং গুহায় লুকিয়ে থাকেন।", english),
    ).toBeNull();
  });
});
