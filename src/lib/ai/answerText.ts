const SOURCE_WORDS = "সূত্র|সূত্রসমূহ|তথ্যসূত্র|রেফারেন্স|Sources?|References?";

const TRAILING_SOURCE_BLOCK = new RegExp(
  String.raw`\n+[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|__)?[ \t]*(?:${SOURCE_WORDS})[ \t]*:?[ \t]*(?:\*\*|__)?[ \t]*:?[ \t]*(?:\n[\s\S]*)?$`,
);

const SPACED_DASH = /\s+[—–]\s+/g;
const TIGHT_DASH = /([^\s])[—–]([^\s])/g;
const LEADING_DASH = /^([ \t]*)[—–][ \t]+/gm;

const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/gu;
const OTHER_LETTER = /(?=\p{L})[\p{Script=Bengali}\p{Script=Latin}]/gu;
const ARABIC_BLOCK_TOLERANCE = 0.15;

export function isArabicDominant(text: string): boolean {
  const arabic = text.match(ARABIC_LETTER)?.length ?? 0;
  if (arabic === 0) return false;

  const other = text.match(OTHER_LETTER)?.length ?? 0;
  return other <= arabic * ARABIC_BLOCK_TOLERANCE;
}

export function normalizeDashes(text: string): string {
  return text.replace(LEADING_DASH, "$1- ").replace(SPACED_DASH, ", ").replace(TIGHT_DASH, "$1-$2");
}

export function stripTrailingSources(text: string): string {
  return text.replace(TRAILING_SOURCE_BLOCK, "").trimEnd();
}

const ORPHAN_CITATIONS = /\n{2,}[ \t]*(?:[-–—*•>][ \t]*)?((?:\[\d+\][ \t,]*)+)(?=\n|$)/g;

export function attachOrphanCitations(text: string): string {
  return text.replace(
    ORPHAN_CITATIONS,
    (_, markers: string) => ` ${markers.trim().replace(/,$/, "")}`,
  );
}

export function neutralizeBackticks(text: string): string {
  return text.replace(/`/g, "‘");
}

const INTRO_THEN_ARABIC = /^(.*?[^\s؀-ۿ][:ঃ]\s+)([؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿].*)$/;

export function separateArabicQuotes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(INTRO_THEN_ARABIC);
      const intro = match?.[1];
      const quote = match?.[2];
      if (!intro || !quote) return line;
      if (isArabicDominant(intro) || !isArabicDominant(quote)) return line;
      if (quote.trim().split(/\s+/).length < 3) return line;
      return `${intro.trimEnd()}\n\n${quote}`;
    })
    .join("\n");
}

export function prepareAnswer(text: string): string {
  return neutralizeBackticks(
    separateArabicQuotes(normalizeDashes(attachOrphanCitations(stripTrailingSources(text)))),
  );
}

export function splitMarkdownBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fenced = false;
  let math = false;

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) fenced = !fenced;
    if (trimmed === "$$") math = !math;

    if (trimmed.length === 0 && !fenced && !math) {
      if (current.length > 0) blocks.push(current.join("\n"));
      current = [];
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}
