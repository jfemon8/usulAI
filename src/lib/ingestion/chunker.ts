import { RETRIEVAL_CONFIG } from "@/config/site";

export function chunkText(
  text: string,
  size: number = RETRIEVAL_CONFIG.chunkSize,
  overlap: number = RETRIEVAL_CONFIG.chunkOverlap,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }

  return chunks;
}
