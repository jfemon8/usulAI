import { generateText } from "ai";
import { RERANK_CONFIG } from "@/config/site";
import { getModelChain } from "@/lib/ai/providers";
import { logger } from "@/lib/utils/logger";
import type { RetrievedChunk } from "@/types";

const RERANK_SYSTEM = `তুমি একটি প্রাসঙ্গিকতা-যাচাইকারী। একটি প্রশ্ন আর নম্বর দেওয়া কিছু উদ্ধৃতি পাবে। যেগুলো প্রশ্নের উত্তর দিতে সত্যিই কাজে লাগে শুধু সেগুলোর নম্বর ফেরত দাও।

নিয়ম:
- শুধু নম্বরগুলো কমা দিয়ে লেখো, যেমন: 1,4,7
- কোনোটিই প্রাসঙ্গিক না হলে শুধু লেখো: NONE
- ব্যাখ্যা, বাক্য বা অন্য কিছু লিখো না।
- একই শব্দ থাকলেই প্রাসঙ্গিক নয় — বিষয়বস্তু আসলে প্রশ্নের উত্তরে সাহায্য করছে কিনা দেখো।
- সন্দেহ হলে বাদ দাও। কম কিন্তু সঠিক উদ্ধৃতি বেশি ভালো।`;

function parseKeepList(text: string, total: number): number[] | null {
  const cleaned = text.trim().toUpperCase();
  if (cleaned.startsWith("NONE")) return [];

  const numbers = [...text.matchAll(/\d+/g)]
    .map((match) => Number(match[0]))
    .filter((value) => value >= 1 && value <= total);

  return numbers.length > 0 ? [...new Set(numbers)] : null;
}

export async function rerankContext(
  question: string,
  context: RetrievedChunk[],
): Promise<RetrievedChunk[]> {
  if (context.length < RERANK_CONFIG.minCandidates) return context;

  const [tier] = getModelChain();
  if (!tier) return context;

  const listing = context
    .map(
      (chunk, index) =>
        `${index + 1}. (${chunk.citation.reference}) ${chunk.content.replace(/\s+/g, " ").slice(0, RERANK_CONFIG.snippetChars)}`,
    )
    .join("\n");

  try {
    const { text } = await generateText({
      model: tier.model,
      system: RERANK_SYSTEM,
      prompt: `প্রশ্ন: ${question}\n\nউদ্ধৃতিসমূহ:\n${listing}\n\nপ্রাসঙ্গিক নম্বর:`,
      maxRetries: 1,
    });

    const keep = parseKeepList(text, context.length);
    if (keep === null) return context;

    const filtered = keep
      .map((position) => context[position - 1])
      .filter((chunk): chunk is RetrievedChunk => Boolean(chunk));

    logger.info(`Re-ranked context: kept ${filtered.length} of ${context.length}`);
    return filtered;
  } catch (error) {
    logger.warn("Re-ranking skipped, using raw context", {
      error: String(error).slice(0, 160),
    });
    return context;
  }
}
