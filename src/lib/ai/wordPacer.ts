import { STREAM_PACING_CONFIG } from "@/config/site";

export interface WordPacer {
  push: (text: string) => void;
  finish: () => Promise<void>;
  started: () => boolean;
}

interface PacerDependencies {
  write: (chunk: string) => void;
  sleep?: (ms: number) => Promise<void>;
  tickMs?: number;
  maxLagMs?: number;
}

const WORD = /\S+\s+|\s+/g;

export function takeCompleteWords(buffer: string): { words: string[]; rest: string } {
  const words: string[] = [];
  let consumed = 0;

  for (const match of buffer.matchAll(WORD)) {
    if (match.index !== consumed) break;
    words.push(match[0]);
    consumed += match[0].length;
  }

  return { words, rest: buffer.slice(consumed) };
}

export function wordsPerTick(backlog: number, tickMs: number, maxLagMs: number): number {
  return Math.max(1, Math.ceil(backlog / Math.max(1, Math.floor(maxLagMs / tickMs))));
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createWordPacer({
  write,
  sleep = defaultSleep,
  tickMs = STREAM_PACING_CONFIG.tickMs,
  maxLagMs = STREAM_PACING_CONFIG.maxLagMs,
}: PacerDependencies): WordPacer {
  const queue: string[] = [];
  let pending = "";
  let closed = false;
  let pushed = false;
  let loop: Promise<void> | null = null;
  let wake: (() => void) | null = null;

  async function drain() {
    for (;;) {
      if (queue.length === 0) {
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        wake = null;
        continue;
      }

      const count = wordsPerTick(queue.length, tickMs, maxLagMs);
      write(queue.splice(0, count).join(""));
      if (queue.length > 0 || !closed) await sleep(tickMs);
    }
  }

  function enqueue(words: string[]) {
    if (words.length === 0) return;
    queue.push(...words);
    loop ??= drain();
    wake?.();
  }

  return {
    push(text) {
      if (text.length === 0) return;
      pushed = true;
      const { words, rest } = takeCompleteWords(pending + text);
      pending = rest;
      enqueue(words);
    },
    async finish() {
      if (pending.length > 0) {
        enqueue([pending]);
        pending = "";
      }
      closed = true;
      wake?.();
      await loop;
    },
    started: () => pushed,
  };
}
