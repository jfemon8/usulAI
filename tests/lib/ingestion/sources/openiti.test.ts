import { describe, expect, it } from "vitest";
import {
  convertOpenIti,
  pageRangeIndex,
  repairedPageNumbers,
  splitLongHeading,
} from "@/lib/ingestion/sources/openiti";

const meta = {
  title: "روضة الناظر",
  author: "ابن قدامة",
  part: "كتاب القياس",
  license: "CC BY-NC-SA 4.0",
  source: "https://example.org/rawda",
  version: "0620IbnQudamaMaqdisi.RawdatNazir.JK000156-ara1",
};

const book = [
  "######OpenITI#",
  "#META#Header#End#",
  "# | باب الإجماع",
  "# الإجماع حجة قاطعة. PageV01P010",
  "# وتمام الكلام في الإجماع. PageV01P011",
  "# | باب القياس",
  "# القياس حمل فرع على أصل. PageV01P012",
  "# | فصل",
  "# والعلة هي الوصف الجامع. PageV01P013",
  "### | [ص: 14]",
  "# | فصل في التقليد",
  "# التقليد قبول قول الغير. PageV01P014",
].join("\n");

describe("convertOpenIti", () => {
  it("keeps only the requested pages and cites their real page numbers", () => {
    const { markdown, pages } = convertOpenIti(book, meta, new Map(), {
      ranges: [{ from: [1, 12], to: [1, 13] }],
      inlineHeadings: true,
      tidyHeadings: true,
    });

    expect(pages).toBe(2);
    expect(markdown).toContain("[পৃষ্ঠা 12]");
    expect(markdown).toContain("[পৃষ্ঠা 13]");
    expect(markdown).toContain("## باب القياس");
    expect(markdown).not.toContain("الإجماع حجة");
    expect(markdown).not.toContain("التقليد قبول");
    expect(markdown).toContain('part: "كتاب القياس"');
  });

  it("opens an excerpt with its configured heading instead of the previous chapter", () => {
    const { markdown } = convertOpenIti(book, meta, new Map(), {
      ranges: [{ from: [1, 13], to: [1, 13], heading: "باب القياس" }],
      inlineHeadings: true,
      tidyHeadings: true,
    });

    expect(markdown.indexOf("## باب القياس")).toBeLessThan(markdown.indexOf("[পৃষ্ঠা 13]"));
  });

  it("treats short pipe lines as headings but not bare section words or printed page numbers", () => {
    const { markdown } = convertOpenIti(book, meta, new Map(), {
      inlineHeadings: true,
      tidyHeadings: true,
    });

    expect(markdown).toContain("## باب الإجماع");
    expect(markdown).not.toContain("## فصل\n");
    expect(markdown).not.toContain("ص: 14");
    expect(markdown).not.toMatch(/^\|/m);
  });

  it("leaves books converted without options exactly as before", () => {
    const { markdown } = convertOpenIti(book, meta);

    expect(markdown).not.toContain("## باب القياس");
    expect(markdown).toContain("[পৃষ্ঠা 10]");
    expect(markdown).toContain("[পৃষ্ঠা 14]");
  });
});

describe("repairing page markers", () => {
  it("fixes a single mistyped page number between two consecutive neighbours", () => {
    expect(
      repairedPageNumbers([
        [1, 94],
        [1, 95],
        [1, 69],
        [1, 97],
        [1, 100],
        [1, 102],
        [1, 102],
        [1, 103],
      ]),
    ).toEqual([94, 95, 96, 97, 100, 101, 102, 103]);
  });

  it("keeps genuine gaps and volume changes", () => {
    expect(
      repairedPageNumbers([
        [1, 10],
        [1, 14],
        [1, 15],
        [2, 1],
        [2, 2],
      ]),
    ).toEqual([10, 14, 15, 1, 2]);
  });

  it("turns ampersand markers into headings and drops bare section words", () => {
    const marked = [
      "#META#Header#End#",
      "# & فصل &",
      "# & القسم الثاني &",
      "# نص الصفحة. & فصل &",
      "# نص آخر. PageV01P005",
    ].join("\n");
    const { markdown } = convertOpenIti(marked, meta, new Map(), { markedHeadings: true });

    expect(markdown).toContain("## القسم الثاني");
    expect(markdown).not.toContain("&");
  });
});

describe("long headings and biography entries", () => {
  const entry =
    "بلال بن رباح المؤذن يكنى أبا عبدالله وقيل أبا عبدالكريم وقيل أبا عبدالرحمن وهو مولى أبي بكر الصديق شهد بدرا وأحدا";

  it("keeps a biography entry's text in the body under a short title", () => {
    const raw = ["#META#Header#End#", `### $ ${entry}`, "# أخبرنا عبدالوارث PageV01P178"].join(
      "\n",
    );
    const { markdown } = convertOpenIti(raw, meta);

    expect(markdown).toContain("## بلال بن رباح المؤذن يكنى أبا عبدالله وقيل أبا عبدالكريم…");
    expect(markdown).toContain(`\n${entry}\n`);
    expect(markdown).not.toContain("$");
  });

  it("keeps a verse marked as an inline line in the body instead of making it a heading", () => {
    const raw = [
      "#META#Header#End#",
      "# | % حقا أقول لعبد الله آمره % إن لم تقاتل لدى عثمان فانطلق %",
      "# وقال غيره PageV01P010",
    ].join("\n");
    const { markdown } = convertOpenIti(raw, meta, new Map(), { inlineHeadings: true });

    expect(markdown).not.toContain("## %");
    expect(markdown).toContain("% حقا أقول لعبد الله آمره % إن لم تقاتل لدى عثمان فانطلق %");
  });

  it("keeps a short biography name in the body too", () => {
    expect(splitLongHeading("126- فاطمة بنت رسول الله", true)).toEqual([
      "## 126- فاطمة بنت رسول الله",
      "126- فاطمة بنت رسول الله",
    ]);
  });

  it("uses a leading bracketed title and never drops the text of a long heading", () => {
    const text = `[ذكر رعايته لهن ] ${entry}`;

    expect(splitLongHeading(text)).toEqual(["## ذكر رعايته لهن", text]);
    expect(splitLongHeading("باب صلاة الجمعة")).toEqual(["## باب صلاة الجمعة"]);
  });
});

describe("pageRangeIndex", () => {
  const ranges = [
    { from: [1, 174], to: [1, 178] },
    { from: [4, 1273], to: [5, 1539] },
  ] as const;

  it("finds the range across volumes and rejects pages outside every range", () => {
    expect(pageRangeIndex(ranges, 1, 176)).toBe(0);
    expect(pageRangeIndex(ranges, 5, 1400)).toBe(1);
    expect(pageRangeIndex(ranges, 5, 1540)).toBe(-1);
    expect(pageRangeIndex([], 9, 9)).toBe(0);
  });
});
