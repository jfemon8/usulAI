import { describe, expect, it } from "vitest";
import { sectionsFromPlainText } from "@/lib/ingestion/sources/bookStructure";
import { convertGutenbergSira, convertWikisourceSira } from "@/lib/ingestion/sources/publicDomain";

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
