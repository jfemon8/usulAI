import { ANSWER_GATE_CONFIG } from "@/config/site";
import type { QuestionLanguage } from "@/lib/ai/language";
import { ARABIC_LETTER, arabicRuns, normalizeArabic } from "@/lib/ai/arabicText";
import { findLoopStart, normalizeForLoopCheck } from "@/lib/ai/repetitionGuard";

export interface GateInput {
  contextTexts: string[];
  references: string[];
  question: string;
  language: QuestionLanguage;
}

export interface GateVerdict {
  ok: boolean;
  reasons: string[];
}

const BENGALI_LETTER = /(?=\p{L})\p{Script=Bengali}/u;
const FOREIGN_LETTER = /(?=\p{L})(?!\p{Script=Bengali})\p{L}/u;
const LATIN_WORD = /\p{Script=Latin}{3,}/gu;
const FOREIGN_SCRIPT_LETTER =
  /(?![\p{Script=Bengali}\p{Script=Latin}\p{Script=Arabic}\p{Script=Common}\p{Script=Inherited}])[\p{L}\p{M}]|[\u067E\u0686\u0698\u0679\u0688\u0691\u06A9\u06AF\u06BA\u06BE\u06CC\u06D2]/gu;
const CITATION = /\[(\d+)\]/g;

const HONORIFICS = [
  "صلى الله عليه وسلم",
  "رضي الله عنه",
  "رضي الله عنها",
  "رضي الله عنهم",
  "عليه السلام",
  "رحمه الله",
  "سبحانه وتعالى",
  "بسم الله الرحمن الرحيم",
];

const NORMALIZED_HONORIFICS = HONORIFICS.map(normalizeArabic);

function pieces(normalizedRun: string): string[][] {
  let parts = [normalizedRun];

  for (const honorific of NORMALIZED_HONORIFICS) {
    parts = parts.flatMap((part) => part.split(honorific));
  }

  return parts.map((part) => arabicWords(part));
}

function arabicWords(normalized: string): string[] {
  return normalized.split(" ").filter((word) => ARABIC_LETTER.test(word));
}

export function groundingHaystack(texts: readonly string[]): string {
  return ` ${arabicWords(normalizeArabic(texts.join("\n\n"))).join(" ")} `;
}

export function isArabicRunGrounded(run: string, haystack: string): boolean {
  const { minArabicRunWords, minArabicMatchRatio } = ANSWER_GATE_CONFIG;
  let windows = 0;
  let found = 0;

  for (const words of pieces(normalizeArabic(run))) {
    for (let start = 0; start + minArabicRunWords <= words.length; start += 1) {
      windows += 1;
      const window = words.slice(start, start + minArabicRunWords).join(" ");
      if (haystack.includes(` ${window} `)) found += 1;
    }
  }

  return windows === 0 || found / windows >= minArabicMatchRatio;
}

function checkArabic(answer: string, haystack: string): string[] {
  return arabicRuns(answer)
    .filter((run) => !isArabicRunGrounded(run, haystack))
    .map((run) => `arabic-not-verbatim: ${normalizeArabic(run).slice(0, 48)}`);
}

function checkCitations(answer: string, sourceCount: number): string[] {
  const invalid = [...answer.matchAll(CITATION)]
    .map((match) => Number(match[1]))
    .filter((index) => index < 1 || index > sourceCount);

  return invalid.length > 0 ? [`citation-out-of-range: ${[...new Set(invalid)].join(",")}`] : [];
}

function checkMixedScript(answer: string): string[] {
  const mixed = answer
    .split(/\s+/)
    .filter((token) => BENGALI_LETTER.test(token) && FOREIGN_LETTER.test(token));

  return mixed.length > 0 ? [`mixed-script-word: ${mixed.slice(0, 3).join(" ")}`] : [];
}

function checkForeignScript(answer: string, context: string): string[] {
  const alien = [...new Set(answer.match(FOREIGN_SCRIPT_LETTER) ?? [])].filter(
    (letter) => !context.includes(letter),
  );

  return alien.length > 0 ? [`foreign-script-letters: ${alien.slice(0, 6).join(" ")}`] : [];
}

function checkForeignLatin(answer: string, input: GateInput): string[] {
  if (input.language === "other") return [];

  const allowed = new Set(
    [...input.references, input.question].join(" ").toLowerCase().match(LATIN_WORD) ?? [],
  );

  const foreign = new Set(
    (answer.match(LATIN_WORD) ?? [])
      .map((word) => word.toLowerCase())
      .filter((word) => !allowed.has(word)),
  );

  return foreign.size > ANSWER_GATE_CONFIG.maxForeignLatinWords
    ? [`foreign-latin-words: ${[...foreign].slice(0, 4).join(" ")}`]
    : [];
}

const LANGUAGE_PROBE_LETTERS = 60;

export function answerLanguageMatches(
  answer: string,
  language: QuestionLanguage,
  final = false,
): boolean | null {
  const prose = answer.replace(/\[\d+\]/g, "");
  const bengali = (prose.match(/(?=\p{L})\p{Script=Bengali}/gu) ?? []).length;
  const latin = (prose.match(/\p{Script=Latin}/gu) ?? []).length;
  const letters = bengali + latin;
  if (letters < LANGUAGE_PROBE_LETTERS && !final) return null;
  if (letters === 0) return true;

  const bengaliShare = bengali / letters;
  return language === "other" ? bengaliShare <= 0.3 : bengaliShare >= 0.5;
}

export function validateAnswer(answer: string, input: GateInput): GateVerdict {
  const contextJoined = input.contextTexts.join("\n\n");

  const reasons = [
    ...checkArabic(answer, groundingHaystack([contextJoined, ...input.references])),
    ...checkCitations(answer, input.contextTexts.length),
    ...(findLoopStart(answer, normalizeForLoopCheck(contextJoined), "all") === null
      ? []
      : ["repetition-loop"]),
    ...checkMixedScript(answer),
    ...checkForeignScript(answer, contextJoined),
    ...checkForeignLatin(answer, input),
    ...(answerLanguageMatches(answer, input.language, true) === false
      ? [`language-mismatch: expected ${input.language}`]
      : []),
  ];

  return { ok: reasons.length === 0, reasons };
}
