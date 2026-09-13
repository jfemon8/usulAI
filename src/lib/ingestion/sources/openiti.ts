export interface OpenItiFrontMatter {
  title: string;
  author: string;
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
      const heading = line.trim().match(HEADING);
      const title = heading?.[1]?.replace(/^-\[|\]-$/g, "").trim();
      if (title) pending.push(title);
    }
  }

  return result;
}

function pageLabel(volume: number, page: number, multiVolume: boolean): string {
  return multiVolume ? `[খণ্ড ${volume}, পৃষ্ঠা ${page}]` : `[পৃষ্ঠা ${page}]`;
}

function frontMatter(meta: OpenItiFrontMatter): string {
  const lines = Object.entries(meta).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return ["---", ...lines, "---", ""].join("\n");
}

export function convertOpenIti(
  raw: string,
  meta: OpenItiFrontMatter,
  injectedHeadings: Map<string, string[]> = new Map(),
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

  const renderLines = (text: string): string[] =>
    text
      .split("\n")
      .map((line) => line.trim())
      .flatMap((line) => {
        const heading = line.match(HEADING);
        if (heading) {
          const title = heading[1]?.replace(/^-\[|\]-$/g, "").trim();
          if (!title) return [];
          headings += 1;
          return [`## ${title}`];
        }
        const paragraph = line.replace(/^#\s*/, "").trim();
        return paragraph.length > 0 ? [paragraph] : [];
      });

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
    if (lines.length === 0) continue;

    const injected = injectedHeadings.get(`${volume}:${page}`) ?? [];
    headings += injected.length;
    output.push(
      "",
      ...injected.map((title) => `## ${title}`),
      pageLabel(volume, page, multiVolume),
      ...lines,
    );
    pages += 1;
  }

  const tail = renderLines(buffered);
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
