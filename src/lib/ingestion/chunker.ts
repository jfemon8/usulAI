import { RETRIEVAL_CONFIG } from "@/config/site";

const BREAKS: readonly RegExp[] = [/\n\s*\n/g, /[।!?.]\s/g, /\n/g, /[,;:]\s/g, /\s/g];

function breakPoint(text: string, end: number, minEnd: number): number {
  const window = text.slice(minEnd, end);

  for (const pattern of BREAKS) {
    let last = -1;
    for (const match of window.matchAll(pattern)) last = match.index + match[0].length;
    if (last > 0) return minEnd + last;
  }

  return end;
}

function wordStart(text: string, index: number, floor: number): number {
  let position = index;
  while (position > floor && !/\s/.test(text[position - 1] ?? "")) position -= 1;
  return position > floor ? position : index;
}

export function chunkText(
  text: string,
  size: number = RETRIEVAL_CONFIG.chunkSize,
  overlap: number = RETRIEVAL_CONFIG.chunkOverlap,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const hardEnd = Math.min(start + size, text.length);
    const end =
      hardEnd === text.length
        ? hardEnd
        : breakPoint(text, hardEnd, start + Math.floor(size * RETRIEVAL_CONFIG.minChunkFill));

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end === text.length) break;

    const next = wordStart(text, Math.max(end - overlap, start + 1), start + 1);
    start = next;
  }

  return chunks;
}
