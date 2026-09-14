import { composeNukta } from "@/lib/utils/bangla";

export const QUESTION_FILLER = new Set(
  [
    "কী",
    "কি",
    "কার",
    "কারা",
    "কে",
    "কেন",
    "কোন",
    "কোনো",
    "কীভাবে",
    "কিভাবে",
    "কোথায়",
    "কয়টি",
    "উপর",
    "সম্পর্কে",
    "বিষয়ে",
    "ব্যাপারে",
    "করা",
    "করে",
    "হয়",
    "হয়েছে",
    "হবে",
    "বলে",
    "বলা",
    "বলেছে",
    "বলেছেন",
    "বলুন",
    "আছে",
    "এসেছে",
    "দিয়েছে",
    "নির্দেশ",
    "বিধান",
    "জানতে",
    "চাই",
    "এবং",
    "ও",
    "the",
    "what",
    "does",
    "say",
    "says",
    "about",
    "is",
    "are",
    "of",
    "on",
    "in",
    "to",
    "a",
    "an",
    "and",
    "how",
    "why",
    "who",
  ].map(composeNukta),
);

const WORD_SPLIT = /[\s,.।?!"'()[\]:;-]+/u;

export function isFiller(word: string): boolean {
  return QUESTION_FILLER.has(composeNukta(word.toLowerCase()));
}

export function topicQuery(query: string): string {
  const words = query.split(WORD_SPLIT).filter((word) => word.length > 0);
  const topic = words.filter((word) => !isFiller(word));
  return topic.some((word) => /\p{L}{2}/u.test(word)) ? topic.join(" ") : query;
}
