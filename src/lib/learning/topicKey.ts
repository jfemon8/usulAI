import { isFiller } from "@/lib/retrieval/questionFiller";
import { composeNukta } from "@/lib/utils/bangla";

function normalizeForTopic(question: string): string {
  return composeNukta(question)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function topicKey(question: string): string {
  const words = normalizeForTopic(question)
    .split(" ")
    .filter((word) => word.length > 0 && !isFiller(word));
  return [...new Set(words)].sort().join(" ");
}
