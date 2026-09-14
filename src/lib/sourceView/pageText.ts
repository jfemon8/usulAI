export interface MergedPage {
  text: string;
  spans: { start: number; end: number }[];
}

export type ViewBlockKind = "arabic" | "text";

export interface ViewBlock {
  kind: ViewBlockKind;
  text: string;
  label?: string;
  highlight?: boolean;
  heading?: boolean;
}

const ARABIC_LETTER = /\p{Script=Arabic}/gu;
const HAS_ARABIC_LETTER = /\p{Script=Arabic}/u;
const BANGLA_OR_LATIN_LETTER = /[\p{Script=Bengali}\p{Script=Latin}]/gu;

export function hasArabicLetter(text: string): boolean {
  return HAS_ARABIC_LETTER.test(text);
}

export function isArabicText(text: string): boolean {
  const arabic = text.match(ARABIC_LETTER)?.length ?? 0;
  const other = text.match(BANGLA_OR_LATIN_LETTER)?.length ?? 0;
  return arabic > 0 && arabic >= other;
}

function overlapLength(
  previous: string,
  next: string,
  maxOverlap: number,
  minOverlap: number,
): number {
  const limit = Math.min(maxOverlap, previous.length, next.length);
  for (let length = limit; length >= minOverlap; length -= 1) {
    if (previous.endsWith(next.slice(0, length))) return length;
  }
  return 0;
}

export function mergeChunks(chunks: string[], maxOverlap: number, minOverlap = 1): MergedPage {
  let text = "";
  const spans: MergedPage["spans"] = [];

  for (const chunk of chunks) {
    const overlap = overlapLength(text, chunk, maxOverlap, Math.max(1, minOverlap));
    const joiner = overlap === 0 && text.length > 0 ? "\n" : "";
    const start = overlap > 0 ? text.length - overlap : text.length + joiner.length;
    text = `${text}${joiner}${chunk.slice(overlap)}`;
    spans.push({ start, end: start + chunk.length });
  }

  return { text, spans };
}

export function pageBlocks(
  text: string,
  highlight: { start: number; end: number } | null,
): ViewBlock[] {
  const blocks: ViewBlock[] = [];

  const pushRange = (from: number, to: number, highlighted: boolean) => {
    if (to <= from) return;
    for (const paragraph of text.slice(from, to).split("\n")) {
      const trimmed = paragraph.trim();
      if (trimmed.length === 0) continue;
      blocks.push({
        kind: isArabicText(trimmed) ? "arabic" : "text",
        text: trimmed,
        ...(highlighted ? { highlight: true } : {}),
      });
    }
  };

  if (!highlight) {
    pushRange(0, text.length, false);
    return blocks;
  }

  let start = Math.max(0, Math.min(highlight.start, text.length));
  let end = Math.max(start, Math.min(highlight.end, text.length));
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  if (!hasArabicLetter(text.slice(lineStart, start))) start = lineStart;
  const lineBreak = text.indexOf("\n", end);
  const lineEnd = lineBreak < 0 ? text.length : lineBreak;
  if (!hasArabicLetter(text.slice(end, lineEnd))) end = lineEnd;

  pushRange(0, start, false);
  pushRange(start, end, true);
  pushRange(end, text.length, false);

  return blocks;
}
