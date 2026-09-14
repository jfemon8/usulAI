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
      /(^|[\s(-])([a-z])/g,
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
