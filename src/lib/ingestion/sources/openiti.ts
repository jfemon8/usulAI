import type { OpenItiPageRange } from "@/config/site";

export interface OpenItiFrontMatter {
  title: string;
  author: string;
  part?: string;
  license: string;
  source: string;
  version: string;
}

export interface OpenItiConversion {
  markdown: string;
  pages: number;
  headings: number;
}

const HEADER_END = "#META#Header#End#";
const PAGE = /PageV(\d+)P(\d+)/g;
const HEADING = /^###\s*\|+\s*(?:AUTO\s+|CHECK\s+)?(.*)$/;
const PRINTED_PAGE_HEADING = /^\[?ص:\s*\d+\]?$/;
const INLINE_HEADING = /^#\s*\|\s*(.+)$/;
const GENERIC_HEADING = /^(?:فصل|فصول|مسألة|مسائل|فرع|فائدة|تنبيه|تتمة|باب)[\s:.]*$/;
const MAX_INLINE_HEADING_CHARS = 90;

export interface OpenItiOptions {
  ranges?: readonly OpenItiPageRange[];
  inlineHeadings?: boolean;
  tidyHeadings?: boolean;
}

function headingTitle(raw: string | undefined, tidy = false): string | undefined {
  const trimmed = raw?.replace(/^-\[|\]-$/g, "").trim();
  const title = tidy ? trimmed?.replace(/^\[([^\]]+)\][\s:.]*$/, "$1").trim() : trimmed;
  return title && !PRINTED_PAGE_HEADING.test(title) ? title : undefined;
}

function inlineHeadingTitle(line: string, tidy: boolean): string | undefined {
  const title = line
    .match(INLINE_HEADING)?.[1]
    ?.replace(/^[-*\s]+/, "")
    .trim();
  if (!title || title.length > MAX_INLINE_HEADING_CHARS || GENERIC_HEADING.test(title)) {
    return undefined;
  }
  return headingTitle(title, tidy);
}

function pageOrder(volume: number, page: number): number {
  return volume * 100_000 + page;
}

export function pageRangeIndex(
  ranges: readonly OpenItiPageRange[],
  volume: number,
  page: number,
): number {
  if (ranges.length === 0) return 0;
  const order = pageOrder(volume, page);
  return ranges.findIndex(
    ({ from, to }) => order >= pageOrder(from[0], from[1]) && order <= pageOrder(to[0], to[1]),
  );
}

export function openItiBody(raw: string): string {
  const index = raw.indexOf(HEADER_END);
  return index >= 0 ? raw.slice(index + HEADER_END.length) : raw;
}

export function cleanOpenItiText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n~~/g, " ")
    .replace(/\bms\d+\b/g, "")
    .replace(/\s*\(¬\d+\)/g, "")
    .replace(/\s*\(\d{1,3}\)/g, "")
    .replace(/@QB@\s*/g, "﴿")
    .replace(/\s*@QE@/g, "﴾")
    .replace(/@[A-Z]+\d*@?/g, "")
    .replace(/%~%/g, " … ")
    .replace(/[ \t]{2,}/g, " ");
}

export function headingsByPage(raw: string): Map<string, string[]> {
  const body = cleanOpenItiText(openItiBody(raw));
  const result = new Map<string, string[]>();
  const pending: string[] = [];

  for (const piece of body.split(/(PageV\d+P\d+)/)) {
    const marker = piece.match(/^PageV(\d+)P(\d+)$/);
    if (marker) {
      const key = `${Number(marker[1])}:${Number(marker[2])}`;
      if (pending.length > 0) result.set(key, [...(result.get(key) ?? []), ...pending]);
      pending.length = 0;
      continue;
    }

    for (const line of piece.split("\n")) {
      const title = headingTitle(line.trim().match(HEADING)?.[1]);
      if (title) pending.push(title);
    }
  }

  return result;
}

function pageLabel(volume: number, page: number, multiVolume: boolean): string {
  return multiVolume ? `[খণ্ড ${volume}, পৃষ্ঠা ${page}]` : `[পৃষ্ঠা ${page}]`;
}

function frontMatter(meta: OpenItiFrontMatter): string {
  const lines = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return ["---", ...lines, "---", ""].join("\n");
}

export function convertOpenIti(
  raw: string,
  meta: OpenItiFrontMatter,
  injectedHeadings: Map<string, string[]> = new Map(),
  { ranges = [], inlineHeadings = false, tidyHeadings = false }: OpenItiOptions = {},
): OpenItiConversion {
  const body = cleanOpenItiText(openItiBody(raw));
  const volumes = new Set(
    [...body.matchAll(PAGE)].map((match) => Number(match[1])).filter(Boolean),
  );
  const multiVolume = volumes.size > 1;

  const output: string[] = [frontMatter(meta)];
  let buffered = "";
  let pages = 0;
  let headings = 0;
  let skippedHeading: string | undefined;
  let currentRange = -1;

  const renderLines = (text: string): string[] =>
    text
      .split("\n")
      .map((line) => line.trim())
      .flatMap((line) => {
        const heading = line.match(HEADING);
        if (heading) {
          const title = headingTitle(heading[1], tidyHeadings);
          return title ? [`## ${title}`] : [];
        }
        const inline = inlineHeadings ? inlineHeadingTitle(line, tidyHeadings) : undefined;
        if (inline) return [`## ${inline}`];
        const paragraph = line.replace(inlineHeadings ? /^#\s*\|?\s*/ : /^#\s*/, "").trim();
        return paragraph.length > 0 ? [paragraph] : [];
      });

  const isHeading = (line: string): boolean => line.startsWith("## ");

  for (const piece of body.split(/(PageV\d+P\d+)/)) {
    const marker = piece.match(/^PageV(\d+)P(\d+)$/);

    if (!marker) {
      buffered += piece;
      continue;
    }

    const volume = Number(marker[1]);
    const page = Number(marker[2]);

    if (volume === 0) continue;

    const lines = renderLines(buffered);
    buffered = "";
    const injected = (injectedHeadings.get(`${volume}:${page}`) ?? []).map(
      (title) => `## ${title}`,
    );

    const rangeIndex = pageRangeIndex(ranges, volume, page);
    if (rangeIndex < 0) {
      skippedHeading = [...injected, ...lines].findLast(isHeading) ?? skippedHeading;
      continue;
    }
    if (rangeIndex !== currentRange) {
      currentRange = rangeIndex;
      const opening = ranges[rangeIndex]?.heading;
      if (opening) skippedHeading = `## ${opening}`;
    }

    if (lines.length === 0) continue;

    if (tidyHeadings && lines.every(isHeading)) {
      skippedHeading = [...injected, ...lines].findLast(isHeading);
      continue;
    }

    const opensWithHeading = injected.length > 0 || (lines[0] !== undefined && isHeading(lines[0]));
    const carried = skippedHeading && !opensWithHeading ? [skippedHeading] : [];
    skippedHeading = undefined;

    headings += carried.length + injected.length + lines.filter(isHeading).length;
    output.push("", ...carried, ...injected, pageLabel(volume, page, multiVolume), ...lines);
    pages += 1;
  }

  const tail = ranges.length === 0 ? renderLines(buffered) : [];
  if (tail.length > 0) output.push("", ...tail);

  return {
    markdown: `${output
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()}\n`,
    pages,
    headings,
  };
}
