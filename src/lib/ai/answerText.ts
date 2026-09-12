const SOURCE_WORDS = "সূত্র|সূত্রসমূহ|তথ্যসূত্র|রেফারেন্স|Sources?|References?";

const TRAILING_SOURCE_BLOCK = new RegExp(
  String.raw`\n+[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|__)?[ \t]*(?:${SOURCE_WORDS})[ \t]*:?[ \t]*(?:\*\*|__)?[ \t]*:?[ \t]*(?:\n[\s\S]*)?$`,
);

const SPACED_DASH = /\s+[—–]\s+/g;
const TIGHT_DASH = /([^\s])[—–]([^\s])/g;
const LEADING_DASH = /^([ \t]*)[—–][ \t]+/gm;

export function normalizeDashes(text: string): string {
  return text.replace(LEADING_DASH, "$1- ").replace(SPACED_DASH, ", ").replace(TIGHT_DASH, "$1-$2");
}

export function stripTrailingSources(text: string): string {
  return text.replace(TRAILING_SOURCE_BLOCK, "").trimEnd();
}

export function prepareAnswer(text: string): string {
  return normalizeDashes(stripTrailingSources(text));
}
