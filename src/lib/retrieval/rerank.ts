import { AUXILIARY_CONFIG, RERANK_CONFIG } from "@/config/site";
import { generateWithChainFrom } from "@/lib/ai/auxiliaryModel";
import { TRANSLATION_LABELS, sanitizeSourceContent } from "@/lib/ingestion/translations";
import { arabicQueryTerms } from "@/lib/retrieval/arabicTerms";
import { isFiller } from "@/lib/retrieval/questionFiller";
import { expandQueryTerms } from "@/lib/retrieval/synonyms";
import { logger } from "@/lib/utils/logger";
import { createLru, normalizeCacheKey } from "@/lib/utils/lru";
import type { RetrievedChunk, SourceType } from "@/types";

const RERANK_SYSTEM = `তুমি একটি প্রাসঙ্গিকতা-যাচাইকারী। একটি প্রশ্ন আর নম্বর দেওয়া কিছু উদ্ধৃতি পাবে। যেগুলো প্রশ্নের উত্তর দিতে সত্যিই কাজে লাগে শুধু সেগুলোর নম্বর ফেরত দাও।

নিয়ম:
- শুধু নম্বরগুলো কমা দিয়ে লেখো, যেমন: 1,4,7
- কোনোটিই প্রাসঙ্গিক না হলে শুধু লেখো: NONE
- ব্যাখ্যা, বাক্য বা অন্য কিছু লিখো না।
- একই শব্দ থাকলেই প্রাসঙ্গিক নয়; বিষয়বস্তু আসলে প্রশ্নের উত্তরে সাহায্য করছে কিনা দেখো।
- শুধু স্পষ্টভাবে ভিন্ন বিষয়ের উদ্ধৃতি বাদ দাও। প্রশ্নের বিষয়ের সাথে সম্পর্কিত হলে, এমনকি আংশিক উত্তর দিলেও, রেখে দাও।
- সন্দেহ হলে রেখে দাও। সঠিক দলিল বাদ পড়ে যাওয়া বেশি ক্ষতিকর।`;

const TRANSLATION_BLOCK = new RegExp(
  `^(?:${TRANSLATION_LABELS.bangla}|${TRANSLATION_LABELS.english})\\s*:`,
);

export function questionTerms(question: string): string[] {
  const words = question
    .toLowerCase()
    .split(/[\s,.।?!"'()[\]:;।-]+/u)
    .filter((word) => [...word].length >= 2 && !isFiller(word));

  return [
    ...new Set([
      ...words,
      ...expandQueryTerms(question).map((term) => term.toLowerCase()),
      ...arabicQueryTerms(question),
    ]),
  ];
}

function focusWindow(text: string, terms: string[], size: number): string {
  if (text.length <= size || terms.length === 0) return text.slice(0, size);

  const lower = text.toLowerCase();
  const hits = terms
    .flatMap((term) =>
      [...lower.matchAll(new RegExp(escapeRegExp(term), "gu"))].map((m) => m.index),
    )
    .sort((a, b) => a - b);

  if (hits.length === 0) return text.slice(0, size);

  const lead = Math.floor(size / 5);
  let bestStart = 0;
  let bestCount = -1;

  for (const hit of hits) {
    const start = Math.max(0, Math.min(hit - lead, text.length - size));
    const count = hits.filter((other) => other >= start && other < start + size).length;
    if (count > bestCount) {
      bestCount = count;
      bestStart = start;
    }
  }

  const window = text.slice(bestStart, bestStart + size);
  return bestStart > 0 ? `…${window.slice(1)}` : window;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildRerankSnippet(content: string, question?: string): string {
  const translations = sanitizeSourceContent(content)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => TRANSLATION_BLOCK.test(block));

  const source = (translations.length > 0 ? translations.join(" ") : content).replace(/\s+/g, " ");

  return focusWindow(source, question ? questionTerms(question) : [], RERANK_CONFIG.snippetChars);
}

export function parseKeepList(text: string, total: number): number[] | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const digitLine = lines.find((line) => /\d/.test(line));

  if (digitLine === undefined) {
    return /\bNONE\b/i.test(text) ? [] : null;
  }

  const numbers = [...digitLine.matchAll(/\d+/g)]
    .map((match) => Number(match[0]))
    .filter((value) => value >= 1 && value <= total);

  if (numbers.length === 0) {
    return /\bNONE\b/i.test(text) ? [] : null;
  }

  return [...new Set(numbers)];
}

const verdictCache = createLru<string[]>(AUXILIARY_CONFIG.rerankCacheSize);

function verdictKey(question: string, group: RetrievedChunk[]): string {
  return `${normalizeCacheKey(question)}::${group
    .map((chunk) => chunk.id)
    .sort()
    .join(",")}`;
}

async function rerankGroup(question: string, group: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  if (group.length < RERANK_CONFIG.minCandidates) return group;

  const key = verdictKey(question, group);
  const cached = verdictCache.get(key);

  if (cached) {
    const keptIds = new Set(cached);
    return group.filter((chunk) => keptIds.has(chunk.id));
  }

  const listing = group
    .map(
      (chunk, index) =>
        `${index + 1}. (${chunk.citation.reference}) ${buildRerankSnippet(chunk.content, question)}`,
    )
    .join("\n");

  const request = {
    system: RERANK_SYSTEM,
    prompt: `প্রশ্ন: ${question}\n\nউদ্ধৃতিসমূহ:\n${listing}\n\nপ্রাসঙ্গিক নম্বর:`,
  };

  try {
    const verdict = await generateWithChainFrom("Re-rank", request, 0);
    if (!verdict) return group;

    let keep = parseKeepList(verdict.text, group.length);
    if (keep === null) return group;

    if (keep.length === 0) {
      const second = await generateWithChainFrom(
        "Re-rank second opinion",
        request,
        verdict.attempt + 1,
      );
      const overturned = second ? parseKeepList(second.text, group.length) : null;
      if (overturned && overturned.length > 0) {
        logger.info(
          `Re-rank: second opinion kept ${overturned.length} of ${group.length} ${group[0]?.sourceType} chunks the first judge dropped`,
        );
        keep = overturned;
      }
    }

    const kept = keep
      .map((position) => group[position - 1])
      .filter((chunk): chunk is RetrievedChunk => Boolean(chunk));

    verdictCache.set(
      key,
      kept.map((chunk) => chunk.id),
    );

    return kept;
  } catch (error) {
    logger.warn("Re-ranking skipped, using raw context", {
      error: String(error).slice(0, 160),
    });
    return group;
  }
}

function groupBySource(context: RetrievedChunk[]): RetrievedChunk[][] {
  const groups = new Map<SourceType, RetrievedChunk[]>();

  for (const chunk of context) {
    const existing = groups.get(chunk.sourceType);
    if (existing) existing.push(chunk);
    else groups.set(chunk.sourceType, [chunk]);
  }

  return [...groups.values()];
}

export async function rerankContext(
  question: string,
  context: RetrievedChunk[],
): Promise<RetrievedChunk[]> {
  if (context.length < RERANK_CONFIG.minCandidates) return context;

  const kept = await Promise.all(
    groupBySource(context).map((group) => rerankGroup(question, group)),
  );

  const survivors = new Set(kept.flat().map((chunk) => chunk.id));
  const filtered = context.filter((chunk) => survivors.has(chunk.id));

  logger.info(`Re-ranked context: kept ${filtered.length} of ${context.length}`);
  return filtered;
}
