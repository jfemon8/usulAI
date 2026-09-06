export const TRANSLATION_LABELS = {
  bangla: "বাংলা",
  english: "English",
} as const;

export function normalizeText(value: string): string {
  return value.replace(/^﻿/, "").trim();
}

export function buildSourceContent(arabic: string, bangla: string, english: string): string {
  const blocks = [normalizeText(arabic)];
  const banglaText = normalizeText(bangla);
  const englishText = normalizeText(english);

  if (banglaText) blocks.push(`${TRANSLATION_LABELS.bangla}: ${banglaText}`);
  if (englishText) blocks.push(`${TRANSLATION_LABELS.english}: ${englishText}`);

  return blocks.filter(Boolean).join("\n\n");
}
