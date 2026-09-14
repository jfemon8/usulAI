import { describe, expect, it } from "vitest";
import { sectionsFromPlainText } from "@/lib/ingestion/sources/bookStructure";
import {
  convertArchiveOcr,
  convertGutenbergSira,
  convertWikisourceSira,
  pagesFromDjvuXml,
  pagesFromSearchText,
} from "@/lib/ingestion/sources/publicDomain";

const meta = {
  title: "Test Sira",
  author: "Author",
  license: "Public domain",
  source: "https://example.org",
  note: "সহায়ক উৎস",
};

describe("convertGutenbergSira", () => {
  const raw = [
    "Preface that is skipped",
    "CHAPTER THE FIRST",
    "",
    "[Sidenote: THE BIRTH OF MOHAMMAD]",
    "",
    "[Illustration: _A scribe._",
    "Calligraphy]",
    "He was born in _Makkah_",
    "in the Year of the Elephant.",
    "",
    "CHAPTER THE SECOND",
    "[Sidenote: THE HEGIRA]",
    "The emigration to Yathrib.",
    "BIBLIOGRAPHY",
    "Works listed here are skipped",
  ].join("\n");

  it("keeps only the chapters and turns sidenotes into chapter headings", () => {
    const { markdown, chapters } = convertGutenbergSira(raw, meta, {
      startLine: "CHAPTER THE FIRST",
      endLine: "BIBLIOGRAPHY",
    });

    expect(chapters).toBe(2);
    expect(markdown).not.toContain("Preface");
    expect(markdown).not.toContain("Works listed");
    expect(markdown).not.toContain("Illustration");
    expect(markdown).toContain("He was born in Makkah in the Year of the Elephant.");

    const sections = sectionsFromPlainText(markdown);
    expect(sections.map((section) => section.chapter)).toEqual([
      "Chapter 1: The Birth Of Mohammad",
      "Chapter 2: The Hegira",
    ]);
  });
});

describe("convertWikisourceSira", () => {
  const html = [
    '<div class="ws-header">Header junk</div>',
    '<div class="prp-pages-output" lang="en">',
    '<span class="pagenum ws-pagenum" id="1" data-page-number="1"><span class="pagenum-inner">\u200b</span></span>',
    '<div class="wst-center tiInherit"><p>PART I</p></div>',
    '<div class="wst-center tiInherit"><p><i>At Mecca</i></p></div>',
    '<p>He was born at Mecca.<span class="wst-sidenote wst-sidenote-right"><span class="wst-sidenote-inner">The Prophet&#39;s birth.</span></span> His father died.<sup id="cite_ref-1" class="reference"><a>[1]</a></sup></p>',
    '<span class="pagenum ws-pagenum" id="2" data-page-number="2"><span class="pagenum-inner">\u200b</span></span>',
    "<p>He married Khadîjah.</p>",
    '<div class="reflist">Footnotes</div>',
  ].join("\n");

  it("keeps printed pages, turns part titles and sidenotes into headings, and drops references", () => {
    const { markdown, pages } = convertWikisourceSira(html, meta);

    expect(pages).toBe(2);
    expect(markdown).not.toContain("Header junk");
    expect(markdown).not.toContain("Footnotes");
    expect(markdown).not.toContain("[1]");

    const sections = sectionsFromPlainText(markdown);
    expect(sections).toEqual([
      { text: "He was born at Mecca.", chapter: "Part I, At Mecca", page: 1 },
      { text: "His father died.", chapter: "Part I, At Mecca, The Prophet's birth", page: 1 },
      { text: "He married Khadîjah.", chapter: "Part I, At Mecca, The Prophet's birth", page: 2 },
    ]);
  });
});

describe("convertArchiveOcr", () => {
  const pageTexts = [
    [
      "12 MINHAJ ET TALIBIN",
      "BOOK 2.—PRAYER",
      "Prayer is obligatory for every adult Moslem of sound mind, and the ablu- tion must precede it.*",
      "* The translator notes a variant reading here.",
    ].join("\n"),
    [
      "PRAYER 13",
      "ajLmo JLw q^j bu lAXJve *j&i ^l &te",
      "The time of the noon prayer begins when the sun has passed the meridian.",
      "Digitized by Google",
    ].join("\n"),
    [
      "14 MINHAJ ET TALIBIN",
      "The afternoon prayer begins when the shadow of a thing equals its length.",
    ].join("\n"),
  ];
  const text = pageTexts.join("\n");
  const index = pageTexts.reduce<number[][]>((spans, page) => {
    const start = spans.length === 0 ? 0 : (spans.at(-1)?.[1] ?? 0) + 1;
    return [...spans, [start, start + page.length]];
  }, []);

  it("drops running heads, footnotes and OCR junk, and cites the printed page", () => {
    const pages = [
      { leaf: 0, paragraphs: ["Title page"] },
      ...pagesFromSearchText(text, index),
    ].map((page, leaf) => ({ ...page, leaf }));
    const { markdown } = convertArchiveOcr([{ pages, fromLeaf: 1, toLeaf: 3 }], meta, {
      runningHead: /^(?:\d{1,3}\s+MINHAJ ET TALIBIN|[A-Z ]+\s+\d{1,3})$/u,
      footnote: /^[*]\s+/u,
    });

    expect(sectionsFromPlainText(markdown)).toEqual([
      {
        text: "Prayer is obligatory for every adult Moslem of sound mind, and the ablution must precede it.",
        chapter: "Book 2.—Prayer",
        page: 12,
      },
      {
        text: "The time of the noon prayer begins when the sun has passed the meridian.",
        chapter: "Book 2.—Prayer",
        page: 13,
      },
      {
        text: "The afternoon prayer begins when the shadow of a thing equals its length.",
        chapter: "Book 2.—Prayer",
        page: 14,
      },
    ]);
  });

  it("reads paragraphs and hyphenated lines from DjVu XML", () => {
    const xml =
      "<DjVuXML><OBJECT><HIDDENTEXT><PARAGRAPH><LINE><WORD>A</WORD><WORD>wo-</WORD></LINE><LINE><WORD>man</WORD><WORD>&amp;</WORD><WORD>her</WORD></LINE></PARAGRAPH></HIDDENTEXT></OBJECT><OBJECT></OBJECT></DjVuXML>";

    expect(pagesFromDjvuXml(xml)).toEqual([
      { leaf: 0, paragraphs: ["A wo-\nman & her"] },
      { leaf: 1, paragraphs: [] },
    ]);
  });
});
