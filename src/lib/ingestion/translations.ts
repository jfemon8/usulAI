export const TRANSLATION_LABELS = {
  bangla: "বাংলা",
  english: "English",
} as const;

export function normalizeText(value: string): string {
  return value.replace(/^\uFEFF/, "").trim();
}

const LABEL_PREFIX = new RegExp(
  `^(${TRANSLATION_LABELS.bangla}|${TRANSLATION_LABELS.english})\\s*:\\s*`,
);
const LEADING_DANDA = /^[।|]\s*/;
const FOOTNOTE_MARKER = /\s*\[[\d০-৯]+\]/g;

function cleanTranslationBlock(block: string): string {
  const label = block.match(LABEL_PREFIX);
  if (!label) return block;

  const body = block
    .slice(label[0].length)
    .replace(LEADING_DANDA, "")
    .replace(FOOTNOTE_MARKER, "")
    .trim();

  return `${label[1]}: ${body}`;
}

export interface SourceBlocks {
  arabic: string;
  bangla?: string;
  english?: string;
}

export function splitSourceBlocks(content: string): SourceBlocks {
  const blocks: SourceBlocks = { arabic: "" };
  const arabic: string[] = [];

  for (const block of sanitizeSourceContent(content).split(/\n{2,}/)) {
    const label = block.match(LABEL_PREFIX);

    if (label?.[1] === TRANSLATION_LABELS.bangla)
      blocks.bangla = block.slice(label[0].length).trim();
    else if (label?.[1] === TRANSLATION_LABELS.english) {
      blocks.english = block.slice(label[0].length).trim();
    } else if (block.trim().length > 0) arabic.push(block.trim());
  }

  blocks.arabic = arabic.join("\n");
  return blocks;
}

export function sanitizeSourceContent(content: string): string {
  return content
    .split(/\n{2,}/)
    .map((block) => cleanTranslationBlock(block.trim()))
    .join("\n\n");
}

export const DIRECTIONAL_MARK_PATTERN = "[\u200E\u200F]";
const DIRECTIONAL_MARKS = new RegExp(DIRECTIONAL_MARK_PATTERN, "g");

export function stripDirectionalMarkCharacters(text: string): string {
  return text.replace(DIRECTIONAL_MARKS, "");
}

export function buildSourceContent(arabic: string, bangla: string, english: string): string {
  const blocks = [stripDirectionalMarkCharacters(normalizeText(arabic))];
  const banglaText = stripDirectionalMarkCharacters(normalizeText(bangla));
  const englishText = stripDirectionalMarkCharacters(normalizeText(english));

  if (banglaText) blocks.push(`${TRANSLATION_LABELS.bangla}: ${banglaText}`);
  if (englishText) blocks.push(`${TRANSLATION_LABELS.english}: ${englishText}`);

  return blocks.filter(Boolean).join("\n\n");
}
