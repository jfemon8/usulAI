const SOURCE_WORDS = "সূত্র|সূত্রসমূহ|তথ্যসূত্র|রেফারেন্স|Sources?|References?";

const TRAILING_SOURCE_BLOCK = new RegExp(
  String.raw`\n+[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|__)?[ \t]*(?:${SOURCE_WORDS})[ \t]*:?[ \t]*(?:\*\*|__)?[ \t]*:?[ \t]*(?:\n[\s\S]*)?$`,
);

const SPACED_DASH = /\s+[—–]\s+/g;
const TIGHT_DASH = /([^\s])[—–]([^\s])/g;
const LEADING_DASH = /^([ \t]*)[—–][ \t]+/gm;

const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/gu;
const OTHER_LETTER = /(?=\p{L})[\p{Script=Bengali}\p{Script=Latin}]/gu;
const ARABIC_BLOCK_TOLERANCE = 0.15;

export function isArabicDominant(text: string): boolean {
  const arabic = text.match(ARABIC_LETTER)?.length ?? 0;
  if (arabic === 0) return false;

  const other = text.match(OTHER_LETTER)?.length ?? 0;
  return other <= arabic * ARABIC_BLOCK_TOLERANCE;
}

export function normalizeDashes(text: string): string {
  return text.replace(LEADING_DASH, "$1- ").replace(SPACED_DASH, ", ").replace(TIGHT_DASH, "$1-$2");
}

const SOURCE_HEADING =
  /^[\s>*_#-]*(?:সূত্র(?:সমূহ)?|তথ্যসূত্র|রেফারেন্স(?:সমূহ)?|references?|sources?|citations?)[\s*_]*[:ঃ]?[\s*_]*$/iu;
const CITED_ENTRY = /\[\d+\]\s*\([^)]*\)?/g;
const MARKER_GROUP = /\[\d+(?:\s*,\s*\d+)*\]/g;
const LIST_FILLER = /[\s,;.:।*_\-–—•]+/gu;
const REFERENCE_HEADING_WORDS = [
  "সূত্র",
  "তথ্যসূত্র",
  "রেফারেন্স",
  "references",
  "sources",
  "citations",
];

const ECHO_LABELS = String.raw`কুরআন|হাদিস|হাদীস|ইজমা|কি(?:\u09DF|\u09AF\u09BC)াস|সীরাত|ফিকহ|সূত্র|quran|qur'?an|hadith|ijma'?|qiyas|sirah|seerah|sirat|fiqh|source`;
const REFERENCE_ECHO = new RegExp(
  String.raw`(\[\d+\])[ \t]*\((?:${ECHO_LABELS})[^()\n]{0,200}\)|\((?:${ECHO_LABELS})[^()\n]{0,200}\)[ \t]*(\[\d+\])`,
  "giu",
);
const ECHO_TAIL = new RegExp(
  String.raw`(?:\[\d+\][ \t]*(?:\([^()\n]{0,200})?|\([^()\n]{0,200}|\((?:${ECHO_LABELS})[^()\n]{0,200}\)[ \t]*(?:\[\d*)?)$`,
  "iu",
);
const ECHO_LABEL_WORDS = new RegExp(ECHO_LABELS, "giu");

const SECTION_SOURCE = String.raw`(?:আল-)?(?:কুরআন|কোরআন|হাদিস|হাদীস|সুন্নাহ|ইজমা|আলেমদের ঐকমত্য|কি(?:\u09DF|\u09AF\u09BC)াস|সীরাত|জীবনী|ফিকহ|ফতোয়া|মাযহাব|quran|qur'?an|hadith|sunnah|ijma'?|consensus|qiyas|analogy|sirah|seerah|fiqh|fatwa)`;
const SECTION_HEADING = new RegExp(
  String.raw`^[\s>*_#-]*(?:${SECTION_SOURCE}[^\n:ঃ।.]{0,40}?\s*(?:দলিল|দলীল|প্রমাণ)(?:সমূহ)?|(?:evidence|proofs?)\s+from\s+(?:the\s+)?${SECTION_SOURCE}[^\n:.]{0,30})[\s*_]*[:ঃ]?[\s*_]*$`,
  "iu",
);

const MARKDOWN_SOURCE_HEADING = new RegExp(
  String.raw`^(?:#{1,6}\s*|\*\*)(?:[\d০-৯]+[.)।]\s*)?${SECTION_SOURCE}(?:\s*\([^)\n]{0,30}\))?(?:\s+[^\s:ঃ।.*]+){0,2}\s*(?:\*\*)?\s*[:ঃ]?\s*$`,
  "iu",
);

export function isSourceSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  return SECTION_HEADING.test(trimmed) || MARKDOWN_SOURCE_HEADING.test(trimmed);
}

const SENTENCE_END = /(?:[।!?]|(?<=[A-Za-z0-9)"'’])\.)(?:\s*\[\d+(?:\s*,\s*\d+)*\])*(?=\s)/g;
const CITATION_MARKER = /\[\d+(?:\s*,\s*\d+)*\]/;
const UNSUPPORTED_CLAIM = new RegExp(
  [
    String.raw`একমত(?:\s*(?:যে|হয়েছেন|পোষণ|রয়েছেন|আছেন)|\s*[।.,])`,
    String.raw`ঐকমত্য\s*(?:রয়েছে|আছে|হয়েছে|পোষণ|প্রতিষ্ঠিত)`,
    String.raw`ইজমা\s*(?:রয়েছে|আছে|হয়েছে|সংঘটিত|প্রতিষ্ঠিত)`,
    String.raw`(?:scholars|jurists|ulama|imams)\s+(?:are\s+|have\s+)?(?:agreed|unanimous|in\s+agreement)`,
    String.raw`there\s+is\s+(?:a\s+)?consensus`,
    String.raw`(?:রহ\.?|রহঃ|রাহিমাহুল্লাহ)\)?[^।\n]{0,120}(?:উল্লেখ করেছেন|লিখেছেন|বলেছেন|মত দিয়েছেন)`,
  ]
    .map((pattern) => pattern.normalize("NFC"))
    .join("|"),
  "iu",
);
const NEGATED_CLAIM = new RegExp(
  String.raw`পাওয়া যায়নি|পাওয়া যায় নি|নেই|not\s+found|no\s+(?:direct\s+)?(?:evidence|consensus)`.normalize(
    "NFC",
  ),
  "iu",
);

const BENGALI_DIGIT_ZERO = 0x09e6;
const BENGALI_CITATION = /\[([\u09E6-\u09EF]+)(?=\]|,|$)/g;

export function normalizeCitationDigits(text: string): string {
  return text.replace(
    BENGALI_CITATION,
    (_match, digits: string) =>
      `[${[...digits].map((digit) => String(digit.codePointAt(0)! - BENGALI_DIGIT_ZERO)).join("")}`,
  );
}

export function completedSentencesEnd(text: string): number {
  let end = 0;
  for (const match of text.matchAll(SENTENCE_END)) end = match.index + match[0].length;
  return end;
}

function isUnsupportedClaim(sentence: string): boolean {
  const text = sentence.normalize("NFC");
  return UNSUPPORTED_CLAIM.test(text) && !CITATION_MARKER.test(text) && !NEGATED_CLAIM.test(text);
}

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    sentences.push(text.slice(start, end));
    start = end;
  }
  if (start < text.length) sentences.push(text.slice(start));
  return sentences;
}

export function dropSentences(text: string, drop: (sentence: string) => boolean): string {
  return splitSentences(text)
    .map((sentence) => (drop(sentence) ? (sentence.match(/\s*$/)?.[0] ?? "") : sentence))
    .join("");
}

export function dropUnsupportedClaims(text: string): string {
  return dropSentences(text, isUnsupportedClaim);
}

const TRANSLATION_WORD = /[\p{L}\p{M}\p{N}]+/gu;
const MIN_COPIED_WORDS = 5;
const COPY_OVERLAP = 0.85;

function translationWords(text: string): string[] {
  return (
    text.normalize("NFC").toLowerCase().replace(MARKER_GROUP, " ").match(TRANSLATION_WORD) ?? []
  ).filter((word) => word.length >= 2);
}

export function copiedTranslationSource(
  sentence: string,
  translations: readonly { index: number; texts: readonly string[] }[],
): number | null {
  const words = translationWords(sentence);
  if (words.length < MIN_COPIED_WORDS) return null;

  for (const { index, texts } of translations) {
    const vocabulary = new Set(texts.flatMap(translationWords));
    if (vocabulary.size === 0) continue;
    const found = words.filter((word) => vocabulary.has(word)).length;
    if (found / words.length >= COPY_OVERLAP) return index;
  }
  return null;
}

export function stripReferenceEchoes(text: string): string {
  return text.replace(
    REFERENCE_ECHO,
    (_match, before: string | undefined, after: string | undefined) => before ?? after ?? "",
  );
}

export function referenceEchoStart(text: string): number {
  return text.search(ECHO_TAIL);
}

function withoutReferences(text: string, references: readonly string[]): [string, boolean] {
  let rest = text.toLowerCase();
  let removed = false;

  for (const reference of references) {
    const needle = reference.trim().toLowerCase();
    if (needle.length < 3 || !rest.includes(needle)) continue;
    rest = rest.split(needle).join(" ");
    removed = true;
  }

  return [rest, removed];
}

export function isReferenceListLine(line: string, references: readonly string[] = []): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (SOURCE_HEADING.test(trimmed)) return true;

  const entries = (trimmed.match(/\[\d+\]\s*\(/g) ?? []).length;
  const markers = (trimmed.match(MARKER_GROUP) ?? []).length;
  const rest = trimmed
    .replace(CITED_ENTRY, " ")
    .replace(MARKER_GROUP, " ")
    .replace(LIST_FILLER, "");

  if ((entries >= 1 && rest.length <= 12) || (markers >= 3 && rest.length === 0)) return true;
  if (markers === 0 || references.length === 0) return false;

  const [unreferenced, removed] = withoutReferences(trimmed.replace(MARKER_GROUP, " "), references);
  return (
    removed &&
    unreferenced.replace(ECHO_LABEL_WORDS, " ").replace(/[\s,;.:।*_\-–—•()]+/gu, "").length <= 3
  );
}

const REFERENCE_TAIL = /^[\s,;.:।*_()[\]\d-]*$/u;

export function referenceLinePossible(line: string, references: readonly string[] = []): boolean {
  const trimmed = line.replace(/^[\s>*_#-]+/u, "").toLowerCase();
  if (trimmed.length === 0 || /^\[\d*$|^\[\d+[\],\s]/.test(trimmed)) return true;
  if (
    trimmed.length <= 16 &&
    REFERENCE_HEADING_WORDS.some((word) => word.startsWith(trimmed) || trimmed.startsWith(word))
  ) {
    return true;
  }

  const head = trimmed.trimEnd();
  return references.some((reference) => {
    const known = reference.trim().toLowerCase();
    if (known.length < 3) return false;
    return (
      known.startsWith(head) ||
      (head.startsWith(known) && REFERENCE_TAIL.test(head.slice(known.length)))
    );
  });
}

export function stripReferenceLists(text: string): string {
  return text
    .split("\n")
    .filter((line) => !isReferenceListLine(line))
    .join("\n");
}

export function stripTrailingSources(text: string): string {
  return text.replace(TRAILING_SOURCE_BLOCK, "").trimEnd();
}

const ORPHAN_CITATIONS = /\n{2,}[ \t]*(?:[-–—*•>][ \t]*)?((?:\[\d+\][ \t,]*)+)(?=\n|$)/g;

export function attachOrphanCitations(text: string): string {
  return text.replace(
    ORPHAN_CITATIONS,
    (_, markers: string) => ` ${markers.trim().replace(/,$/, "")}`,
  );
}

export function neutralizeBackticks(text: string): string {
  return text.replace(/`/g, "‘");
}

const INTRO_THEN_ARABIC = /^(.*?[^\s؀-ۿ][:ঃ]\s+)([؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿].*)$/;

export function separateArabicQuotes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(INTRO_THEN_ARABIC);
      const intro = match?.[1];
      const quote = match?.[2];
      if (!intro || !quote) return line;
      if (isArabicDominant(intro) || !isArabicDominant(quote)) return line;
      if (quote.trim().split(/\s+/).length < 3) return line;
      return `${intro.trimEnd()}\n\n${quote}`;
    })
    .join("\n");
}

export function prepareAnswer(text: string): string {
  return neutralizeBackticks(
    separateArabicQuotes(
      normalizeDashes(
        attachOrphanCitations(
          stripTrailingSources(
            stripReferenceEchoes(stripReferenceLists(normalizeCitationDigits(text))),
          ),
        ),
      ),
    ),
  );
}

export function splitMarkdownBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fenced = false;
  let math = false;

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) fenced = !fenced;
    if (trimmed === "$$") math = !math;

    if (trimmed.length === 0 && !fenced && !math) {
      if (current.length > 0) blocks.push(current.join("\n"));
      current = [];
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}
