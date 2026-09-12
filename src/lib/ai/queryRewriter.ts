import { detectQuestionLanguage } from "@/lib/ai/language";
import { generateWithChain } from "@/lib/ai/auxiliaryModel";
import { logger } from "@/lib/utils/logger";

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

const MAX_HISTORY_TURNS = 6;
const MAX_TURN_CHARS = 400;

const REWRITE_SYSTEM = `তুমি একটি সার্চ-কুয়েরি রূপান্তরকারী। কথোপকথনের ইতিহাস আর শেষ প্রশ্ন দেখে এমন একটি স্বয়ংসম্পূর্ণ অনুসন্ধান-বাক্য লেখো যা আগের কথা না জানলেও বোঝা যায়।

নিয়ম:
- শুধু অনুসন্ধান-বাক্যটি লেখো, আর কিছু না; ব্যাখ্যা, উদ্ধৃতি চিহ্ন বা ভূমিকা নয়।
- সর্বনাম ("এটা", "সেটার", "ওই বিষয়ে") আগের কথা থেকে বুঝে আসল বিষয় বসাও।
- ইসলামি পরিভাষা মূল রূপে রাখো (সালাত, যাকাত, রিবা, মুদারাবা)।
- বাংলিশ হলে বাংলায় লেখো।
- শেষ প্রশ্নটি এমনিতেই স্বয়ংসম্পূর্ণ হলে সেটাই হুবহু ফেরত দাও।`;

export function needsRewrite(question: string, history: ConversationTurn[]): boolean {
  return history.length > 0 || detectQuestionLanguage(question) === "banglish";
}

export async function rewriteQuery(
  question: string,
  history: ConversationTurn[],
): Promise<{ query: string; rewritten: boolean }> {
  if (!needsRewrite(question, history)) return { query: question, rewritten: false };

  const transcript =
    history.length > 0
      ? history
          .slice(-MAX_HISTORY_TURNS)
          .map(
            (turn) =>
              `${turn.role === "user" ? "ইউজার" : "সহায়ক"}: ${turn.text.slice(0, MAX_TURN_CHARS)}`,
          )
          .join("\n")
      : "(নেই)";

  try {
    const text = await generateWithChain("Query rewrite", {
      system: REWRITE_SYSTEM,
      prompt: `কথোপকথন:\n${transcript}\n\nশেষ প্রশ্ন: ${question}\n\nঅনুসন্ধান-বাক্য:`,
    });

    if (text === null) return { query: question, rewritten: false };

    const query = text.trim().replace(/^["'`]|["'`]$/g, "");

    if (query.length === 0 || query.length > question.length * 8) {
      return { query: question, rewritten: false };
    }

    if (query !== question) {
      logger.info("Rewrote question into search query", { from: question, to: query });
    }

    return { query, rewritten: query !== question };
  } catch (error) {
    logger.warn("Query rewrite failed, using the raw question", {
      error: String(error).slice(0, 160),
    });
    return { query: question, rewritten: false };
  }
}
