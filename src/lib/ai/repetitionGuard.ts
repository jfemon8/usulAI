import { REPETITION_GUARD_CONFIG } from "@/config/site";

interface Word {
  norm: string;
  start: number;
}

export interface GuardStep {
  emit: string;
  stopped: boolean;
}

export interface RepetitionGuard {
  push(delta: string): GuardStep;
  flush(): string;
  wasCut(): boolean;
}

const TAIL_CHARS = 2000;
const SENTENCE_END = /[।?!\n]/g;

function tokenize(text: string, offset = 0): Word[] {
  const words: Word[] = [];

  for (const match of text.matchAll(/\S+/g)) {
    const norm = match[0].replace(/[\p{P}\p{S}]/gu, "");
    if (norm.length > 0) words.push({ norm, start: offset + (match.index ?? 0) });
  }

  return words;
}

function phraseOf(words: Word[], from: number, length: number): string {
  return words
    .slice(from, from + length)
    .map((word) => word.norm)
    .join(" ");
}

function repeatsAt(words: Word[], start: number, size: number): number {
  const phrase = phraseOf(words, start, size);
  let repeats = 1;

  while (
    start + size * (repeats + 1) <= words.length &&
    phraseOf(words, start + size * repeats, size) === phrase
  ) {
    repeats += 1;
  }

  return repeats;
}

export function normalizeForLoopCheck(text: string): string {
  return tokenize(text)
    .map((word) => word.norm)
    .join(" ");
}

export function findLoopStart(
  text: string,
  contextNorm: string,
  scope: "tail" | "all" = "tail",
): number | null {
  const { minRepeats, maxPhraseWords } = REPETITION_GUARD_CONFIG;
  const tailStart = scope === "all" ? 0 : Math.max(0, text.length - TAIL_CHARS);
  const words = tokenize(text.slice(tailStart), tailStart);
  const window = maxPhraseWords * (minRepeats + 1);
  const firstStart = scope === "all" ? 0 : Math.max(0, words.length - window);

  for (let start = firstStart; start < words.length; start += 1) {
    for (let size = 1; size <= maxPhraseWords; size += 1) {
      if (start + size * minRepeats > words.length) break;
      if (repeatsAt(words, start, size) < minRepeats) continue;
      if (contextNorm.includes(phraseOf(words, start, size * minRepeats))) continue;

      const second = words[start + size];
      if (second) return second.start;
    }
  }

  return null;
}

function trimToLastSentence(fragment: string): string {
  const ends = [...fragment.matchAll(SENTENCE_END)];
  const last = ends[ends.length - 1];

  return last?.index === undefined ? "" : fragment.slice(0, last.index + 1);
}

export function createRepetitionGuard(context: string): RepetitionGuard {
  const { holdbackWords } = REPETITION_GUARD_CONFIG;
  const contextNorm = normalizeForLoopCheck(context);
  let text = "";
  let sent = 0;
  let stopped = false;

  return {
    push(delta) {
      if (stopped) return { emit: "", stopped: true };
      text += delta;

      const loopStart = findLoopStart(text, contextNorm);

      if (loopStart !== null) {
        stopped = true;
        const end = Math.max(loopStart, sent);
        const emit = trimToLastSentence(text.slice(sent, end));
        sent = end;
        return { emit, stopped: true };
      }

      const tailStart = Math.max(0, text.length - TAIL_CHARS);
      const words = tokenize(text.slice(tailStart), tailStart);
      const boundaryWord = words[words.length - holdbackWords];
      const boundary = boundaryWord ? boundaryWord.start : tailStart;

      if (boundary <= sent) return { emit: "", stopped: false };

      const emit = text.slice(sent, boundary);
      sent = boundary;
      return { emit, stopped: false };
    },
    flush() {
      if (stopped) return "";
      const emit = text.slice(sent);
      sent = text.length;
      return emit;
    },
    wasCut() {
      return stopped;
    },
  };
}
