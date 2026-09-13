import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/ai/auxiliaryModel", () => ({ generateWithPreferredModels: vi.fn() }));

const {
  mergeVocalization,
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
