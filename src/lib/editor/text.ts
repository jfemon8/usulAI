const MARKDOWN_LINE = [
  /^\s{0,3}#{1,6}\s+\S/m,
  /^\s{0,3}[-*+]\s+\S/m,
  /^\s{0,3}\d{1,9}[.)]\s+\S/m,
  /^\s{0,3}>\s?\S/m,
  /^\s{0,3}(?:```|~~~)/m,
  /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/m,
  /^\s*\|.*\|\s*$\n^\s*\|?\s*:?-{3,}/m,
];

const MARKDOWN_INLINE = [
  /\*\*[^*\n]+\*\*/,
  /__[^_\n]+__/,
  /~~[^~\n]+~~/,
  /`[^`\n]+`/,
  /\[[^\]\n]+\]\((?:https?:\/\/|mailto:|\/|#)[^)\s]*\)/,
  /\$[^$\n]+\$/,
];

const SEMANTIC_HTML =
  /<(?:p|h[1-6]|ul|ol|li|strong|b|em|i|a|table|blockquote|pre|code|br|s|del|strike|hr)[\s>/]/i;

const WORD = /[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]*/gu;

export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false;
  return (
    MARKDOWN_LINE.some((pattern) => pattern.test(text)) ||
    MARKDOWN_INLINE.some((pattern) => pattern.test(text))
  );
}

export function hasSemanticHtml(html: string): boolean {
  return SEMANTIC_HTML.test(html);
}

export function cleanPastedHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|svg|picture|video|audio|iframe|object|noscript)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(?:img|meta|link|source|input|embed)\b[^>]*>/gi, "")
    .replace(/<\/?o:p[^>]*>/gi, "");
}

export function countWords(markdown: string): number {
  return markdown.match(WORD)?.length ?? 0;
}
