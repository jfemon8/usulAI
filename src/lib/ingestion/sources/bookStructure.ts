import { FILE_INGESTION_CONFIG } from "@/config/site";

export interface BookSection {
  text: string;
  chapter?: string;
  page?: number;
}

export interface ChapterStart {
  title: string;
  page: number;
}

export interface BookMetadata {
  title?: string;
  author?: string;
  translator?: string;
  publisher?: string;
  edition?: string;
  year?: string;
  license?: string;
  pageOffset?: number;
  chapters?: ChapterStart[];
}

export interface BookLocation {
  title: string;
  chapter?: string;
  page?: number;
  part: number;
  partCount: number;
}

export interface PdfPageReport {
  sections: BookSection[];
  blankPages: number[];
}

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const PAGE_MARKER = /^\s*[[(]?\s*(?:পৃষ্ঠা|পৃঃ|পৃ\.|page|p\.)\s*[:-]?\s*([0-9০-৯]+)\s*[\])]?\s*$/i;

export function toAsciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
}

function chapterAt(page: number, chapters: readonly ChapterStart[]): string | undefined {
  let current: string | undefined;
  for (const chapter of [...chapters].sort((a, b) => a.page - b.page)) {
    if (chapter.page <= page) current = chapter.title;
  }
  return current;
}

export function sectionsFromPdfPages(
  pages: readonly string[],
  metadata: BookMetadata = {},
): PdfPageReport {
  const offset = metadata.pageOffset ?? 0;
  const sections: BookSection[] = [];
  const blankPages: number[] = [];

  pages.forEach((raw, index) => {
    const page = index + 1 + offset;
    const text = raw.trim();

    if (text.replace(/\s+/g, "").length < FILE_INGESTION_CONFIG.minCharsPerPage) {
      blankPages.push(index + 1);
      return;
    }

    sections.push({ text, page, chapter: chapterAt(page, metadata.chapters ?? []) });
  });

  return { sections, blankPages };
}

export function sectionsFromPlainText(text: string): BookSection[] {
  const sections: BookSection[] = [];
  let chapter: string | undefined;
  let page: number | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body.length > 0) sections.push({ text: body, chapter, page });
    buffer = [];
  };

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const pieces = line.split("\f");

    pieces.forEach((piece, index) => {
      if (index > 0) {
        flush();
        page = (page ?? 1) + 1;
      }

      const heading = piece.match(HEADING);
      const marker = piece.match(PAGE_MARKER);

      if (heading?.[2]) {
        flush();
        chapter = heading[2].trim();
      } else if (marker?.[1]) {
        flush();
        page = Number(toAsciiDigits(marker[1]));
      } else {
        buffer.push(piece);
      }
    });
  }

  flush();
  return sections;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

export function sectionsFromHtml(html: string): BookSection[] {
  const markdown = decodeEntities(
    html
      .replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, body: string) => {
        const title = body.replace(/<[^>]+>/g, "").trim();
        return `\n${"#".repeat(Number(level))} ${title}\n`;
      })
      .replace(/<\/(p|li|tr|div)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );

  return sectionsFromPlainText(markdown);
}

export function formatBookReference(location: BookLocation): string {
  const parts = [location.title];
  if (location.chapter) parts.push(location.chapter);
  if (location.page !== undefined) parts.push(`পৃষ্ঠা ${location.page}`);
  if (location.partCount > 1 || (location.page === undefined && !location.chapter)) {
    parts.push(`অংশ ${location.part}`);
  }
  return parts.join(", ");
}
