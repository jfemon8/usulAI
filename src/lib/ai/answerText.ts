const SOURCE_WORDS = "সূত্র|সূত্রসমূহ|তথ্যসূত্র|রেফারেন্স|Sources?|References?";

const TRAILING_SOURCE_BLOCK = new RegExp(
  String.raw`\n+[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|__)?[ \t]*(?:${SOURCE_WORDS})[ \t]*:?[ \t]*(?:\*\*|__)?[ \t]*:?[ \t]*(?:\n[\s\S]*)?$`,
);

export function stripTrailingSources(text: string): string {
  return text.replace(TRAILING_SOURCE_BLOCK, "").trimEnd();
}
