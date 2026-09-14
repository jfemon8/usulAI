export interface PublicDomainFrontMatter {
  title: string;
  author: string;
  license: string;
  source: string;
  note: string;
}

export interface PublicDomainConversion {
  markdown: string;
  chapters: number;
  pages: number;
}

const ORDINALS = [
  "FIRST",
  "SECOND",
  "THIRD",
  "FOURTH",
  "FIFTH",
  "SIXTH",
  "SEVENTH",
  "EIGHTH",
  "NINTH",
  "TENTH",
  "ELEVENTH",
  "TWELFTH",
];

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function frontMatter(meta: PublicDomainFrontMatter): string {
  const lines = Object.entries(meta).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return ["---", ...lines, "---", ""].join("\n");
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /(^|[\s(\-—])([a-z])/g,
      (_, before: string, letter: string) => before + letter.toUpperCase(),
    );
}

function finish(meta: PublicDomainFrontMatter, body: string[], chapters: number, pages: number) {
  return {
    markdown: `${[frontMatter(meta), ...body]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()}\n`,
    chapters,
    pages,
  };
}

export function convertGutenbergSira(
  raw: string,
  meta: PublicDomainFrontMatter,
  { startLine, endLine }: { startLine: string; endLine: string },
): PublicDomainConversion {
  const text = raw.replace(/\r\n/g, "\n");
  const start = text.search(new RegExp(`^${startLine}\\s*$`, "m"));
  const end = text.search(new RegExp(`^${endLine}\\s*$`, "m"));
  if (start < 0 || end <= start) throw new Error("Gutenberg start or end marker not found");

  const body = text
    .slice(start, end)
    .replace(/\[Illustration:[^\]]*\]/g, "")
    .replace(/_([^_]+)_/g, "$1");

  const output: string[] = [];
  let chapterNumber = 0;
  let headings = 0;

  for (const line of body.split("\n")) {
    const chapter = line.trim().match(/^CHAPTER THE ([A-Z]+)$/);
    const sidenote = line.trim().match(/^\[Sidenote:\s*(.+?)\]$/);

    if (chapter?.[1]) {
      chapterNumber = ORDINALS.indexOf(chapter[1]) + 1 || chapterNumber + 1;
      continue;
    }

    if (sidenote?.[1]) {
      headings += 1;
      output.push("", `# Chapter ${chapterNumber}: ${titleCase(sidenote[1])}`, "");
      continue;
    }

    output.push(line.trim().length === 0 ? "" : line.trim());
  }

  const paragraphs = output
    .join("\n")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph.startsWith("# ") ? paragraph : paragraph.replace(/\n/g, " ").replace(/\s+/g, " "),
    );

  return finish(meta, [paragraphs.join("\n\n")], headings, 0);
}

export interface OcrPage {
  leaf: number;
  paragraphs: string[];
}

export function pagesFromSearchText(text: string, index: readonly number[][]): OcrPage[] {
  return index.map(([start = 0, end = 0], leaf) => ({
    leaf,
    paragraphs: text
      .slice(start, end)
      .split("\n")
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
  }));
}

export function pagesFromDjvuXml(xml: string): OcrPage[] {
  return xml
    .split(/<OBJECT\b/)
    .slice(1)
    .map((object, leaf) => ({
      leaf,
      paragraphs: [...object.matchAll(/<PARAGRAPH>([\s\S]*?)<\/PARAGRAPH>/g)]
        .map(([, paragraph = ""]) =>
          [...paragraph.matchAll(/<LINE>([\s\S]*?)<\/LINE>/g)]
            .map(([, line = ""]) =>
              [...line.matchAll(/<WORD[^>]*>([\s\S]*?)<\/WORD>/g)]
                .map(([, word = ""]) => decodeEntities(word))
                .join(" "),
            )
            .join("\n"),
        )
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    }));
}

export interface ArchiveOcrVolume {
  pages: OcrPage[];
  fromLeaf: number;
  toLeaf: number;
  volume?: number;
}

export interface ArchiveOcrOptions {
  runningHead: RegExp;
  footnote?: RegExp;
}

const OCR_JUNK = /Digitized\s+by|VjOOQ|^Google$|books\s*\.\s*google/i;
const OCR_HEADING_WORDS = /^(?:BOOK|CHAPTER|SECTION|PART|APPENDIX)\b/i;
const OCR_PAGE_WINDOW = 8;
const OCR_MAX_OFFSET_DRIFT = 15;
const OCR_MIN_WORD_SHARE = 0.6;
const OCR_WORD =
  /^[("“‘'[]*(?:\p{Lu}?\p{Ll}+(?:[-'’]\p{L}+)*|\p{Lu}+(?:[-'’]\p{Lu}+)*|\d+[a-z]?|[—–-])[)"”’'\].,;:!?—]*$/u;

function ocrText(paragraph: string): string {
  return paragraph
    .replace(/-\n(\p{Ll})/gu, "$1")
    .replace(/\s+/g, " ")
    .replace(/(\p{Ll})- (\p{Ll})/gu, "$1$2")
    .replace(/([\p{L}.,;:"'’”)])(?:[*†‡§¶]+|\|\|)(?=[\s,.;:"'’”)]|$)/gu, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function isOcrJunk(text: string): boolean {
  if (OCR_JUNK.test(text)) return true;
  const visible = text.replace(/\s/g, "");
  const letters = (visible.match(/[\p{Script=Latin}\d]/gu) ?? []).length;
  if (visible.length < 3 || letters / visible.length < 0.7 || !/\p{L}{3}/u.test(text)) return true;
  const tokens = text.split(/\s+/);
  const words = tokens.filter((token) => OCR_WORD.test(token)).length;
  return tokens.length >= 3 && words / tokens.length < OCR_MIN_WORD_SHARE;
}

function isOcrHeading(text: string): boolean {
  return (
    text.length <= 80 &&
    !/\p{Ll}/u.test(text) &&
    /\p{Lu}{3}/u.test(text) &&
    (OCR_HEADING_WORDS.test(text) || !/\d/.test(text.replace(/\b[AH]\.\s*[DH]\.\s*\d+\.?/g, "")))
  );
}

function headingLabel(text: string): string {
  return text
    .replace(/\bA\.\s*[HD]\.\s*[\d-]+\.?/g, "")
    .replace(/[\s.,;:]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function printedPage(text: string): number | undefined {
  const numbers = [...text.matchAll(/\b(\d{1,4})\b/g)].map((match) => Number(match[1]));
  return numbers.length === 1 && (numbers[0] as number) > 0 ? numbers[0] : undefined;
}

function pageNumbersByLeaf(detected: Map<number, number>, leaves: number[]): Map<number, number> {
  const all = [...detected].map(([leaf, page]) => [leaf, leaf - page] as const);
  const overall = new Map<number, number>();
  for (const [, offset] of all) overall.set(offset, (overall.get(offset) ?? 0) + 1);
  const usual = [...overall].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const offsets = all.filter(([, offset]) => Math.abs(offset - usual) <= OCR_MAX_OFFSET_DRIFT);
  const result = new Map<number, number>();

  for (const leaf of leaves) {
    const nearby = offsets.filter(([other]) => Math.abs(other - leaf) <= OCR_PAGE_WINDOW);
    const pool = nearby.length >= 2 ? nearby : offsets;
    const counts = new Map<number, number>();
    for (const [, offset] of pool) counts.set(offset, (counts.get(offset) ?? 0) + 1);
    const best = [...counts].sort(
      (a, b) => b[1] - a[1] || Math.abs(a[0] - usual) - Math.abs(b[0] - usual),
    )[0];
    if (best && best[1] >= 2 && leaf - best[0] > 0) result.set(leaf, leaf - best[0]);
  }

  return result;
}

export function convertArchiveOcr(
  volumes: readonly ArchiveOcrVolume[],
  meta: PublicDomainFrontMatter,
  { runningHead, footnote }: ArchiveOcrOptions,
): PublicDomainConversion {
  const body: string[] = [];
  let headings = 0;
  let pageCount = 0;

  for (const { pages, fromLeaf, toLeaf, volume } of volumes) {
    const selected = pages.filter((page) => page.leaf >= fromLeaf && page.leaf <= toLeaf);
    const detected = new Map<number, number>();
    const cleaned = selected.map((page) => {
      const paragraphs = page.paragraphs.map(ocrText);
      const kept: string[] = [];

      for (const [index, text] of paragraphs.entries()) {
        const edge = index <= 1 || index === paragraphs.length - 1;
        const numberOnly = /^\W{0,3}\d{1,4}\W{0,3}$/.test(text.replace(/\s/g, ""));
        const head =
          index <= 1 &&
          text.length <= 80 &&
          !OCR_HEADING_WORDS.test(text) &&
          runningHead.test(text);

        if (head || (edge && numberOnly)) {
          const number = printedPage(text.replace(/[lI|](?=\s*\]?$)/, ""));
          if (number !== undefined && !detected.has(page.leaf)) detected.set(page.leaf, number);
          continue;
        }
        if (footnote && index > 0 && kept.length > 0 && footnote.test(text)) break;
        if (isOcrJunk(text)) continue;
        kept.push(text);
      }

      return { leaf: page.leaf, paragraphs: kept };
    });

    const numbers = pageNumbersByLeaf(
      detected,
      cleaned.map((page) => page.leaf),
    );
    let chapter = "";

    for (const page of cleaned) {
      if (page.paragraphs.length === 0) continue;
      const printed = numbers.get(page.leaf);
      body.push(
        "",
        printed === undefined
          ? ""
          : volume === undefined
            ? `[পৃষ্ঠা ${printed}]`
            : `[খণ্ড ${volume}, পৃষ্ঠা ${printed}]`,
      );
      pageCount += 1;

      for (const text of page.paragraphs) {
        if (isOcrHeading(text)) {
          const label = headingLabel(text);
          if (label.length >= 3 && label !== chapter) {
            chapter = label;
            headings += 1;
            body.push("", `# ${titleCase(label)}`, "");
          }
          continue;
        }
        body.push(text);
      }
    }
  }

  return finish(meta, [body.join("\n\n")], headings, pageCount);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? entity);
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\u200b/g, "");
}

export function convertWikisourceSira(
  html: string,
  meta: PublicDomainFrontMatter,
): PublicDomainConversion {
  let content = html
    .slice(html.indexOf(">", Math.max(0, html.indexOf("prp-pages-output"))) + 1)
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<div[^>]*class="[^"]*ws-header[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i, "")
    .replace(/<sup[^>]*class="reference"[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<div[^>]*class="[^"]*reflist[\s\S]*$/i, "");

  let part = "";
  let section = "";
  let pages = 0;
  let headings = 0;

  content = content.replace(
    /<span class="pagenum ws-pagenum"[^>]*data-page-number="(\d+)"[^>]*>[\s\S]*?<\/span>\s*<\/span>/g,
    (_, page: string) => {
      pages += 1;
      return `\n\n@@PAGE ${page}@@\n\n`;
    },
  );
  content = content.replace(
    /<span class="wst-sidenote[^"]*">\s*<span class="wst-sidenote-inner">([\s\S]*?)<\/span>\s*<\/span>/g,
    (_, note: string) => `\n\n@@NOTE ${stripTags(note).trim()}@@\n\n`,
  );
  content = content.replace(
    /<div class="wst-center[^"]*">([\s\S]*?)<\/div>/g,
    (_, centred: string) => `\n\n@@CENTRE ${stripTags(centred).trim()}@@\n\n`,
  );

  const lines = stripTags(content.replace(/<\/(p|blockquote|div)>/gi, "\n\n"))
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const output: string[] = [];
  const heading = () => {
    headings += 1;
    return `# ${[part, section].filter(Boolean).join(", ")}`;
  };

  for (const line of lines) {
    const page = line.match(/^@@PAGE (\d+)@@$/);
    const note = line.match(/^@@NOTE (.+)@@$/);
    const centre = line.match(/^@@CENTRE (.+)@@$/);

    if (page?.[1]) {
      output.push(`[পৃষ্ঠা ${page[1]}]`);
    } else if (note?.[1]) {
      section = note[1].replace(/[.:]$/, "");
      output.push(heading());
    } else if (centre?.[1]) {
      if (/^INTRODUCTION$/i.test(centre[1])) continue;
      part = /^PART\s+[IVX]+$/i.test(centre[1])
        ? titleCase(centre[1]).replace(/\b(Ii|Iii|Iv|Vi)\b/g, (roman) => roman.toUpperCase())
        : part
          ? `${part.split(",")[0]}, ${centre[1]}`
          : centre[1];
      section = "";
      output.push(heading());
    } else {
      output.push(line);
    }
  }

  return finish(meta, [output.join("\n\n")], headings, pages);
}
