import { AUXILIARY_CONFIG } from "@/config/site";
import { detectQuestionLanguage } from "@/lib/ai/language";
import { generateWithChain } from "@/lib/ai/auxiliaryModel";
import { logger } from "@/lib/utils/logger";
import { createLru, normalizeCacheKey } from "@/lib/utils/lru";

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
- ইউজার আগের উত্তর নিয়ে অভিযোগ করলে বা আরও দলিল চাইলে (যেমন "হাদিস থেকে দিলে না কেন?", "আরও দলিল দাও"), অভিযোগের কথাগুলো নয়, আগের আলোচনার মূল বিষয়টি আর যে উৎস চাওয়া হয়েছে তার নাম লেখো, যেমন: "পর্দা সম্পর্কে হাদিস, ইজমা ও কিয়াস"।
- প্রশ্নে সালাম, সম্বোধন, দোয়া, ধন্যবাদ বা ব্যক্তিগত ঘটনার বর্ণনা থাকলে সেগুলো বাদ দাও; শুধু মূল মাসআলার বিষয়টি ফিকহি পরিভাষাসহ ৫ থেকে ১৫ শব্দে লেখো, যেমন: "সফরে কসর নামাজের দূরত্ব ও মেয়াদ"।
- একাধিক প্রশ্ন থাকলে প্রতিটার মূল বিষয় কমা দিয়ে একই বাক্যে রাখো, কোনোটা বাদ দেবে না।
- প্রশ্নের বানান ভুল থাকলে প্রসঙ্গ দেখে সঠিক শব্দ বসাও, কাছাকাছি শোনায় এমন অন্য বিষয়ে চলে যেও না (যেমন "নামাজ সুদ্ধ হবে কি" মানে নামাজ শুদ্ধ বা সহীহ হওয়া, সুদ নয়)।
- পুরো প্রশ্ন ইংরেজিতে হলে ইংরেজিতেই অনুসন্ধান-বাক্য লেখো; বাংলিশ বা বাংলা আর ইংরেজি মেশানো প্রশ্ন (যেমন "Women der jonno loud voice e tilawat jayez?") হলে বাংলায় লেখো। প্রশ্নে যা নেই এমন কোনো শর্ত (যেমন "পুরুষদের সামনে") যোগ করবে না।
- প্রশ্নের কোনো শর্ত, অবস্থা বা বিশেষণ বাদ দেবে না, কারণ বিধান সেটার উপরই নির্ভর করে: বাংলিশ "jore" মানে জোরে, "aste" মানে আস্তে, "chara" মানে ছাড়া, "shomoy" মানে সময়ে, "obosthay" মানে অবস্থায়। যেমন "Mohilara ki jore quran tilawat korte parbe?" হবে "মহিলারা কি জোরে কুরআন তিলাওয়াত করতে পারবে", "কীভাবে" নয়।
- বাংলিশ শব্দের বাংলা বানান প্রচলিত রূপে লেখো (mohila মানে মহিলা, namaz মানে নামাজ)।
- শেষ প্রশ্নটি এমনিতেই স্বয়ংসম্পূর্ণ ও সংক্ষিপ্ত হলে সেটাই হুবহু ফেরত দাও।`;

export function needsRewrite(question: string, history: ConversationTurn[]): boolean {
  return (
    history.length > 0 ||
    detectQuestionLanguage(question) === "banglish" ||
    question.trim().split(/\s+/).length > AUXILIARY_CONFIG.longQuestionWords
  );
}

const rewriteCache = createLru<string>(AUXILIARY_CONFIG.rewriteCacheSize);

export async function rewriteQuery(
  question: string,
  history: ConversationTurn[],
): Promise<{ query: string; rewritten: boolean }> {
  if (!needsRewrite(question, history)) return { query: question, rewritten: false };

  const cacheable = history.length === 0;
  const key = normalizeCacheKey(question);

  if (cacheable) {
    const cached = rewriteCache.get(key);
    if (cached) return { query: cached, rewritten: cached !== question };
  }

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
      signal: AbortSignal.timeout(AUXILIARY_CONFIG.rewriteBudgetMs),
    });

    if (text === null) return { query: question, rewritten: false };

    const query = text.trim().replace(/^["'`]|["'`]$/g, "");

    if (query.length === 0 || query.length > question.length * 8) {
      return { query: question, rewritten: false };
    }

    if (query !== question) {
      logger.info("Rewrote question into search query", { from: question, to: query });
    }

    if (cacheable) rewriteCache.set(key, query);

    return { query, rewritten: query !== question };
  } catch (error) {
    logger.warn("Query rewrite failed, using the raw question", {
      error: String(error).slice(0, 160),
    });
    return { query: question, rewritten: false };
  }
}
