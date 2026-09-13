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
const LATIN_LETTER = /(?=\p{L})\p{Script=Latin}/u;
const LATIN_WORD = /\p{Script=Latin}{3,}/gu;
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

function checkArabic(answer: string, contextArabic: string): string[] {
  const { minArabicRunWords, minArabicMatchRatio } = ANSWER_GATE_CONFIG;
  const haystack = ` ${arabicWords(contextArabic).join(" ")} `;
  const reasons: string[] = [];

  for (const run of arabicRuns(answer)) {
    let windows = 0;
    let found = 0;

    for (const words of pieces(normalizeArabic(run))) {
      for (let start = 0; start + minArabicRunWords <= words.length; start += 1) {
        windows += 1;
        const window = words.slice(start, start + minArabicRunWords).join(" ");
        if (haystack.includes(` ${window} `)) found += 1;
      }
    }

    if (windows > 0 && found / windows < minArabicMatchRatio) {
      reasons.push(`arabic-not-verbatim: ${normalizeArabic(run).slice(0, 48)}`);
    }
  }

  return reasons;
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
    .filter((token) => BENGALI_LETTER.test(token) && LATIN_LETTER.test(token));

  return mixed.length > 0 ? [`mixed-script-word: ${mixed.slice(0, 3).join(" ")}`] : [];
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

export function validateAnswer(answer: string, input: GateInput): GateVerdict {
  const contextJoined = input.contextTexts.join("\n\n");

  const reasons = [
    ...checkArabic(answer, normalizeArabic(contextJoined)),
    ...checkCitations(answer, input.contextTexts.length),
    ...(findLoopStart(answer, normalizeForLoopCheck(contextJoined), "all") === null
      ? []
      : ["repetition-loop"]),
    ...checkMixedScript(answer),
    ...checkForeignLatin(answer, input),
  ];

  return { ok: reasons.length === 0, reasons };
}
