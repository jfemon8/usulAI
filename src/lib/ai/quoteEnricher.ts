import { QUOTE_ENRICHMENT_CONFIG } from "@/config/site";
import {
  ARABIC_LETTER,
  arabicRuns,
  arabicSkeleton,
  arabicWordCount,
  vocalizationRatio,
} from "@/lib/ai/arabicText";
import type { QuestionLanguage } from "@/lib/ai/language";
import { transliterateArabic } from "@/lib/ai/transliterate";

export interface EnrichmentSource {
  index: number;
  reference?: string;
  arabic: string;
  bangla?: string;
  english?: string;
}

export interface EnricherOptions {
  sources: EnrichmentSource[];
  language: QuestionLanguage;
}

export interface QuoteEnricher {
  push(text: string): string;
  flush(): string;
}

interface SourceToken {
  raw: string;
  skeleton: string;
}

interface QuoteMatch {
  sources: EnrichmentSource[];
  segment: string;
  primary: EnrichmentSource;
}

const LABEL_ROOTS = [
  "বাংলা",
  "বাংলায়",
  "অনুবাদ",
  "অর্থ",
  "উচ্চারণ",
  "english",
  "translation",
  "transliteration",
  "pronunciation",
  "meaning",
];

const LABEL_LINE =
  /^(?:বাংলা(?:য়)?(?:\s+এর)?\s*(?:অনুবাদ|অর্থ|উচ্চারণ)?|অনুবাদ|অর্থ|উচ্চারণ|english(?:\s+(?:meaning|translation|pronunciation|transliteration))?|translation|transliteration|pronunciation|meaning)\s*\**\s*[:ঃ]/iu;

const DECORATION = /^[\s>*_•-]+/u;

function stripDecoration(line: string): string {
  return line.replace(DECORATION, "");
}

function isLabelLine(line: string): boolean {
  return LABEL_LINE.test(stripDecoration(line));
}

function labelStillPossible(line: string): boolean {
  const head = stripDecoration(line).toLowerCase();
  if (head.length > QUOTE_ENRICHMENT_CONFIG.labelWindowChars) return false;

  const first = head.match(/^[\p{L}\p{M}]+/u)?.[0] ?? "";
  if (first.length === head.length) return LABEL_ROOTS.some((root) => root.startsWith(first));
  return LABEL_ROOTS.includes(first);
}

function startsWithArabic(line: string): boolean {
  const firstLetter = stripDecoration(line).match(/\p{L}/u)?.[0];
  return firstLetter !== undefined && ARABIC_LETTER.test(firstLetter);
}

function quoteRuns(line: string): string[] {
  return arabicRuns(line).filter(
    (run) => arabicWordCount(run) >= QUOTE_ENRICHMENT_CONFIG.minQuoteWords,
  );
}

function tokenize(text: string): SourceToken[] {
  return text
    .split(/\s+/)
    .filter((token) => /\p{Script=Arabic}/u.test(token))
    .map((raw) => ({ raw, skeleton: arabicSkeleton(raw) }));
}

function locateQuote(run: string, sources: EnrichmentSource[]): QuoteMatch | null {
  const quote = tokenize(run).filter((token) => token.skeleton.length > 0);
  if (quote.length === 0) return null;

  let bestLength = 0;
  let matches: { source: EnrichmentSource; segment: string }[] = [];

  for (const source of sources) {
    const tokens = tokenize(source.arabic);
    const letterIndexes = tokens.flatMap((token, index) => (token.skeleton ? [index] : []));

    for (let q = 0; q < quote.length; q += 1) {
      for (let s = 0; s < letterIndexes.length; s += 1) {
        let length = 0;
        while (
          q + length < quote.length &&
          s + length < letterIndexes.length &&
          quote[q + length]!.skeleton === tokens[letterIndexes[s + length]!]!.skeleton
        ) {
          length += 1;
        }

        if (length === 0 || length < bestLength) continue;

        const segment = tokens
          .slice(letterIndexes[s]!, letterIndexes[s + length - 1]! + 1)
          .map((token) => token.raw)
          .join(" ");

        if (length > bestLength) {
          bestLength = length;
          matches = [];
        }
        if (!matches.some((match) => match.source.index === source.index)) {
          matches.push({ source, segment });
        }
      }
    }
  }

  const needed = Math.min(QUOTE_ENRICHMENT_CONFIG.minQuoteWords, quote.length);
  if (bestLength < needed || bestLength < quote.length * QUOTE_ENRICHMENT_CONFIG.minMatchRatio) {
    return null;
  }

  return {
    sources: matches.map((match) => match.source),
    segment: matches[0]!.segment,
    primary: matches[0]!.source,
  };
}

function skeletonLine(text: string): string {
  return tokenize(text)
    .map((token) => token.skeleton)
    .filter(Boolean)
    .join(" ");
}

function readingFor(match: QuoteMatch): string {
  const matn = extractMatn(match.primary.arabic);
  const matnSkeleton = skeletonLine(matn);
  const segmentSkeleton = skeletonLine(match.segment);

  const quotedChainToo = matnSkeleton.length > 0 && segmentSkeleton.length > matnSkeleton.length;
  return quotedChainToo && segmentSkeleton.includes(matnSkeleton) ? matn : match.segment;
}

function meaningLine(
  label: string,
  sources: EnrichmentSource[],
  pick: (source: EnrichmentSource) => string | undefined,
): string | null {
  const parts = sources.flatMap((source) => {
    const text = pick(source)?.replace(/\s+/g, " ").trim();
    return text ? [`${text} [${source.index}]`] : [];
  });

  return parts.length > 0 ? `**${label}** ${parts.join(" ")}` : null;
}

interface EnrichedBlock {
  text: string;
  matched: number[];
}

function enrichBlock(lines: string[], options: EnricherOptions): EnrichedBlock {
  const bangla = options.language !== "other";
  const runs = lines.flatMap(quoteRuns);
  if (runs.length === 0) return { text: "", matched: [] };

  const readings: string[] = [];
  const matched: EnrichmentSource[] = [];

  for (const run of runs) {
    const match = locateQuote(run, options.sources);
    const reading = match
      ? readingFor(match)
      : vocalizationRatio(run) >= QUOTE_ENRICHMENT_CONFIG.minVocalizationRatio
        ? run
        : null;

    if (reading) {
      const text = transliterateArabic(reading, bangla ? "bn" : "en");
      if (text) readings.push(text);
    }

    for (const source of match?.sources ?? []) {
      if (!matched.some((existing) => existing.index === source.index)) matched.push(source);
    }
  }

  const pronunciation =
    readings.length > 0
      ? `**${bangla ? "বাংলা উচ্চারণঃ" : "English Pronunciation:"}** ${readings.join(" ")}`
      : null;

  const entries = bangla
    ? [
        pronunciation,
        meaningLine("বাংলা অর্থঃ", matched, (source) => source.bangla),
        meaningLine("English Meaning:", matched, (source) => source.english),
      ]
    : [pronunciation, meaningLine("English Meaning:", matched, (source) => source.english)];

  return {
    text: entries.filter((line): line is string => line !== null).join("\n\n"),
    matched: matched.map((source) => source.index),
  };
}

export function buildEnrichment(lines: string[], options: EnricherOptions): string {
  return enrichBlock(lines, options).text;
}

const INVISIBLE_MARKS = new Set([0x200e, 0x200f, 0x061c]);

export function extractMatn(arabic: string): string {
  const visible = [...arabic]
    .filter((char) => !INVISIBLE_MARKS.has(char.codePointAt(0)!))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  const first = visible.indexOf('"');
  const last = visible.lastIndexOf('"');

  if (first >= 0 && last > first) {
    const inner = visible.slice(first + 1, last).trim();
    if (arabicWordCount(inner) >= QUOTE_ENRICHMENT_CONFIG.minQuoteWords) return inner;
  }

  return visible;
}

function evidenceAppendix(seen: string, quoted: Set<number>, options: EnricherOptions): string {
  const bangla = options.language !== "other";
  const cited = [...new Set([...seen.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])))];

  const missing = cited
    .filter((index) => !quoted.has(index))
    .map((index) => options.sources.find((source) => source.index === index))
    .filter((source): source is EnrichmentSource => {
      if (!source) return false;
      return arabicWordCount(extractMatn(source.arabic)) >= QUOTE_ENRICHMENT_CONFIG.minQuoteWords;
    })
    .slice(0, QUOTE_ENRICHMENT_CONFIG.maxAppendedEvidence);

  return missing
    .map((source) => {
      const matn = extractMatn(source.arabic);
      const title = `${bangla ? "দলিল" : "Evidence"} [${source.index}]`;
      const heading = `**${title}${source.reference ? `: ${source.reference}` : ""}**`;
      const block = enrichBlock([matn], { ...options, sources: [source] }).text;
      return [heading, matn, block].filter(Boolean).join("\n\n");
    })
    .join("\n\n");
}

export function createQuoteEnricher(options: EnricherOptions): QuoteEnricher {
  let line = "";
  let state: "undecided" | "prose" | "label" = "undecided";
  let lineEmitted = 0;
  let pending: string[] = [];
  let output = "";
  let tail = "";
  let seen = "";
  const quoted = new Set<number>();

  const emit = (text: string) => {
    if (text.length === 0) return;
    output += text;
    tail = (tail + text).slice(-2);
  };

  const flushPending = () => {
    if (pending.length === 0) return;
    const { text: block, matched } = enrichBlock(pending, options);
    pending = [];
    for (const index of matched) quoted.add(index);
    if (!block) return;

    if (!tail.endsWith("\n\n")) emit(tail.endsWith("\n") ? "\n" : "\n\n");
    emit(`${block}\n\n`);
  };

  const startProse = () => {
    state = "prose";
    if (pending.length > 0 && !startsWithArabic(line)) flushPending();
    emit(line);
    lineEmitted = line.length;
  };

  const decide = () => {
    if (stripDecoration(line).length === 0) return;
    if (isLabelLine(line)) state = "label";
    else if (!labelStillPossible(line)) startProse();
  };

  const endLine = () => {
    if (state === "undecided") {
      if (stripDecoration(line).length === 0) {
        state = "prose";
        emit(line);
      } else if (isLabelLine(line)) {
        state = "label";
      } else {
        startProse();
      }
    } else if (state === "prose") {
      emit(line.slice(lineEmitted));
    }

    if (state !== "label") {
      emit("\n");
      if (quoteRuns(line).length > 0) pending.push(line);
    }

    line = "";
    state = "undecided";
    lineEmitted = 0;
  };

  return {
    push(text) {
      output = "";
      seen += text;
      const pieces = text.split("\n");

      pieces.forEach((piece, index) => {
        line += piece;
        if (index < pieces.length - 1) {
          endLine();
          return;
        }

        if (state === "undecided") decide();
        if (state === "prose") {
          emit(line.slice(lineEmitted));
          lineEmitted = line.length;
        }
      });

      return output;
    },
    flush() {
      output = "";
      if (line.length > 0) {
        if (state === "undecided") {
          if (isLabelLine(line)) state = "label";
          else startProse();
        } else if (state === "prose") {
          emit(line.slice(lineEmitted));
        }
        if (state !== "label" && quoteRuns(line).length > 0) pending.push(line);
        line = "";
        state = "undecided";
        lineEmitted = 0;
      }
      flushPending();

      const appendix = evidenceAppendix(seen, quoted, options);
      if (appendix) {
        if (!tail.endsWith("\n\n")) emit(tail.endsWith("\n") ? "\n" : "\n\n");
        emit(appendix);
      }

      return output;
    },
  };
}

export function enrichAnswer(text: string, options: EnricherOptions): string {
  const enricher = createQuoteEnricher(options);
  return enricher.push(text) + enricher.flush();
}
