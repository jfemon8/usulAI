const INVISIBLE_CODEPOINTS = new Set([
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x061c, 0x0640, 0xfeff,
]);

const ALEF_VARIANTS = new Map<number, string>([
  [0x0623, String.fromCodePoint(0x0627)],
  [0x0625, String.fromCodePoint(0x0627)],
  [0x0622, String.fromCodePoint(0x0627)],
  [0x0671, String.fromCodePoint(0x0627)],
  [0x0649, String.fromCodePoint(0x064a)],
  [0x0629, String.fromCodePoint(0x0647)],
  [0x0624, String.fromCodePoint(0x0648)],
  [0x0626, String.fromCodePoint(0x064a)],
  [0x0621, ""],
]);

export const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/u;
const ANY_LETTER = /\p{L}/u;

function isQuranicAnnotation(codepoint: number): boolean {
  return codepoint >= 0x06d6 && codepoint <= 0x06ed;
}

function stripInvisible(text: string): string {
  return [...text].filter((char) => !INVISIBLE_CODEPOINTS.has(char.codePointAt(0)!)).join("");
}

export function normalizeArabic(text: string): string {
  return [...stripInvisible(text.normalize("NFC"))]
    .filter((char) => !isQuranicAnnotation(char.codePointAt(0)!))
    .join("")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function arabicSkeleton(word: string): string {
  return [...stripInvisible(word.normalize("NFD"))]
    .filter((char) => !/\p{M}/u.test(char))
    .map((char) => ALEF_VARIANTS.get(char.codePointAt(0)!) ?? char)
    .filter((char) => ARABIC_LETTER.test(char))
    .join("");
}

export function arabicWordCount(text: string): number {
  return text.split(/\s+/).filter((token) => ARABIC_LETTER.test(token)).length;
}

export function arabicRuns(text: string): string[] {
  const runs: string[] = [];

  for (const line of text.split("\n")) {
    let current: string[] = [];

    const close = () => {
      if (current.some((token) => ARABIC_LETTER.test(token))) runs.push(current.join(" "));
      current = [];
    };

    for (const token of line.split(/\s+/).filter(Boolean)) {
      if (ARABIC_LETTER.test(token)) current.push(token);
      else if (!ANY_LETTER.test(token) && !/\d/.test(token) && current.length > 0) {
        current.push(token);
      } else close();
    }

    close();
  }

  return runs;
}

export function vocalizationRatio(text: string): number {
  const chars = [...text.normalize("NFD")];
  const letters = chars.filter((char) => ARABIC_LETTER.test(char)).length;
  if (letters === 0) return 0;

  const marks = chars.filter((char) => {
    const codepoint = char.codePointAt(0)!;
    return codepoint >= 0x064b && codepoint <= 0x0652;
  }).length;

  return marks / letters;
}
