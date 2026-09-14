import { createHash } from "crypto";
import { ARABIC_TEXT_SOURCES, DB_CONFIG, SOURCE_TRANSLATION_CONFIG } from "@/config/site";
import { arabicSkeleton, normalizeArabic } from "@/lib/ai/arabicText";
import { isArabicDominant } from "@/lib/ai/answerText";
import { generateWithPreferredModels } from "@/lib/ai/auxiliaryModel";
import { BACKGROUND_PRIORITY_HEADERS } from "@/lib/ai/providers";
import { getDb } from "@/lib/db/mongoClient";
import { TRANSLATION_LABELS } from "@/lib/ingestion/translations";
import { logger } from "@/lib/utils/logger";
import type { RetrievedChunk, TranslatedSegment } from "@/types";

export interface SourceTranslation {
  segments: TranslatedSegment[];
}

interface StoredTranslation extends SourceTranslation {
  _id: string;
  model: string;
  createdAt: Date;
}

const LABEL_BLOCK = new RegExp(
  `^(?:${TRANSLATION_LABELS.bangla}|${TRANSLATION_LABELS.english})\\s*:`,
  "m",
);

export const TRANSLATION_SYSTEM = `তুমি ধ্রুপদী আরবি ফিকহ ও ইজমা গ্রন্থের নির্ভুল অনুবাদক। একটি JSON অ্যারে পাবে, যার প্রতিটি উপাদান একটি আরবি অংশ। ঠিক একই সংখ্যক ও একই ক্রমের একটি JSON অ্যারে ফেরত দাও, অন্য কিছু নয়:
[{"vocalized": "...", "bangla": "...", "english": "..."}]

নিয়ম:
- vocalized: হুবহু একই আরবি অংশ, শুধু পূর্ণ হরকত যোগ করে। কোনো অক্ষর, শব্দ, সংখ্যা বা বিরামচিহ্ন বদলাবে না, যোগ করবে না, বাদ দেবে না।
- bangla: বিশ্বস্ত, প্রাঞ্জল বাংলা অনুবাদ। নিজের ব্যাখ্যা, মতামত বা টীকা যোগ করবে না; বন্ধনীতে নিজে থেকে কোনো শব্দের অর্থ জুড়বে না। কোনো শব্দের অর্থ নিশ্চিত না হলে প্রচলিত ফিকহি পরিভাষা (যেমন ইস্তিহাযা, হাদাস, মুতলাক পানি) রেখে দেবে, আন্দাজে অর্থ বানাবে না।
- মাসআলার নম্বর (যেমন "১ -") থাকলে রেখে দেবে। ব্যক্তির নাম বাংলায় প্রচলিত বানানে লিখবে এবং নামের বানান বদলাবে না।
- english: faithful English translation with no added commentary.
- লম্বা ড্যাশ (—) ব্যবহার করবে না।`;

const NUMBERED_ITEM = /\s(?=[0-9٠-٩]{1,4}\s*-\s)/;

export function splitPassage(arabic: string): string[] {
  const pieces = arabic
    .split("\n")
    .flatMap((line) => line.split(NUMBERED_ITEM))
    .map((piece) => piece.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const segments: string[] = [];
  let carry = "";

  for (const piece of pieces) {
    const joined = carry ? `${carry} ${piece}` : piece;
    if (joined.length < SOURCE_TRANSLATION_CONFIG.minSegmentChars) {
      carry = joined;
      continue;
    }
    segments.push(joined);
    carry = "";
  }

  if (carry) {
    if (segments.length > 0) segments[segments.length - 1] += ` ${carry}`;
    else segments.push(carry);
  }

  return segments;
}

export function translationKey(arabic: string): string {
  return createHash("sha256").update(normalizeArabic(arabic)).digest("hex");
}

export function needsTranslation(chunk: RetrievedChunk): boolean {
  return (
    ARABIC_TEXT_SOURCES.includes(chunk.sourceType) &&
    !LABEL_BLOCK.test(chunk.content) &&
    isArabicDominant(chunk.content)
  );
}

const ALIEN_LETTER =
  /(?=\p{L})(?![\p{Script=Bengali}\p{Script=Latin}\p{Script=Arabic}\p{Script=Common}\p{Script=Inherited}])\p{L}/u;

function hasBrokenScript(text: string): boolean {
  if (ALIEN_LETTER.test(text)) return true;
  return text
    .split(/\s+/)
    .some(
      (token) =>
        /\p{Script=Bengali}/u.test(token) && /[\p{Script=Latin}\p{Script=Arabic}]/u.test(token),
    );
}

function letterShare(text: string, script: RegExp): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  return letters.filter((letter) => script.test(letter)).length / letters.length;
}

export function mergeVocalization(original: string, vocalized: string): string | undefined {
  const source = original.split(/(\s+)/);
  const words = source.filter((_, index) => index % 2 === 0);
  const model = vocalized.split(/\s+/).filter(Boolean);
  const a = words.map(arabicSkeleton);
  const b = model.map(arabicSkeleton);

  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] =
        a[i] && a[i] === b[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  const merged = [...words];
  let matched = 0;
  const letters = a.filter(Boolean).length;
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] && a[i] === b[j]) {
      merged[i] = model[j]!;
      matched += 1;
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) i += 1;
    else j += 1;
  }

  if (letters === 0 || matched / letters < SOURCE_TRANSLATION_CONFIG.minVocalizedShare) {
    return undefined;
  }
  return source.map((piece, index) => (index % 2 === 0 ? merged[index / 2]! : piece)).join("");
}

function readArray(text: string): unknown[] | null {
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  if (!json) return null;

  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const objects = [...json.matchAll(/\{[\s\S]*?\}(?=\s*[,\]])/g)].map((match) => {
      const field = (name: string) =>
        match[0]
          .match(new RegExp(`"${name}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"|\\s*})`))?.[1]
          ?.replace(/\\n/g, "\n")
          .replace(/\\"/g, '"');
      return { vocalized: field("vocalized"), bangla: field("bangla"), english: field("english") };
    });
    return objects.length > 0 ? objects : null;
  }
}

function cleanTranslation(value: unknown): string {
  return typeof value === "string" ? value.replace(/—/g, ", ").replace(/\s+/g, " ").trim() : "";
}

export function parseTranslation(text: string, segments: string[]): SourceTranslation | null {
  const items = readArray(text);
  if (!items || items.length !== segments.length) return null;

  const translated: TranslatedSegment[] = [];

  for (const [index, item] of items.entries()) {
    const fields = (item ?? {}) as Record<string, unknown>;
    const arabic = segments[index]!;
    const bangla = cleanTranslation(fields.bangla);
    const english = cleanTranslation(fields.english);

    if (letterShare(bangla, /\p{Script=Bengali}/u) < SOURCE_TRANSLATION_CONFIG.minBengaliRatio) {
      return null;
    }
    if (letterShare(english, /\p{Script=Latin}/u) < SOURCE_TRANSLATION_CONFIG.minBengaliRatio) {
      return null;
    }
    if (hasBrokenScript(bangla) || hasBrokenScript(english)) return null;

    const vocalized =
      typeof fields.vocalized === "string"
        ? mergeVocalization(arabic, fields.vocalized)
        : undefined;

    translated.push(
      vocalized ? { arabic, vocalized, bangla, english } : { arabic, bangla, english },
    );
  }

  return { segments: translated };
}

async function collection() {
  return (await getDb()).collection<StoredTranslation>(DB_CONFIG.sourceTranslationCollection);
}

export async function loadTranslations(keys: string[]): Promise<Map<string, SourceTranslation>> {
  if (keys.length === 0) return new Map();
  try {
    const rows = await (
      await collection()
    )
      .find({
        _id: { $in: keys },
        segments: { $exists: true },
      })
      .toArray();
    return new Map(rows.map(({ _id, segments }) => [_id, { segments }]));
  } catch (error) {
    logger.warn("Source translation lookup failed", { error: String(error).slice(0, 160) });
    return new Map();
  }
}

export async function translateSource(
  arabic: string,
  reference: string,
  models: readonly string[] = SOURCE_TRANSLATION_CONFIG.models,
): Promise<SourceTranslation | null> {
  const segments = splitPassage(arabic);
  if (segments.length === 0) return null;

  const result = await generateWithPreferredModels(
    "Source translation",
    {
      system: TRANSLATION_SYSTEM,
      prompt: `উৎস: ${reference}\n\n${JSON.stringify(segments, null, 1)}`,
      maxOutputTokens: SOURCE_TRANSLATION_CONFIG.maxOutputTokens,
      timeoutMs: SOURCE_TRANSLATION_CONFIG.timeoutMs,
      headers: BACKGROUND_PRIORITY_HEADERS,
    },
    models,
    true,
  );
  if (!result) return null;

  const translation = parseTranslation(result.text, segments);
  if (!translation) {
    logger.warn("Source translation rejected by validation", {
      reference,
      model: result.modelId,
      segments: segments.length,
      replyChars: result.text.length,
    });
    return null;
  }

  await (
    await collection()
  ).replaceOne(
    { _id: translationKey(arabic) },
    { ...translation, model: result.modelId, createdAt: new Date() },
    { upsert: true },
  );
  return translation;
}

export type PassageKind = "arabic" | "english";

export const ENGLISH_TRANSLATION_SYSTEM = `তুমি ইসলামি ইতিহাস, জীবনী ও ফিকহ গ্রন্থের পুরনো ইংরেজি অনুবাদ থেকে বাংলায় নির্ভুল অনুবাদক। একটি ইংরেজি অংশ পাবে; শুধু তার বিশ্বস্ত, প্রাঞ্জল বাংলা অনুবাদ ফেরত দাও, অন্য কিছু নয়।

নিয়ম:
- নিজের ব্যাখ্যা, মতামত, টীকা বা শিরোনাম যোগ করবে না, কিছু বাদও দেবে না।
- লেখাটি স্ক্যান করা বইয়ের OCR, তাই কিছু বানান ভাঙা থাকতে পারে। ব্যক্তি ও স্থানের নাম প্রচলিত বাংলা বানানে লিখবে; কোনো অংশ পড়া না গেলে অনুমান করে পূরণ করবে না, সেখানে "(অস্পষ্ট)" লিখবে।
- ইসলামি পরিভাষার প্রচলিত বাংলা রূপ ব্যবহার করবে; বাংলা শব্দের ভেতরে ইংরেজি হরফ মেশাবে না।
- লম্বা ড্যাশ (—) ব্যবহার করবে না।`;

const LATIN_LETTER = /\p{Script=Latin}/u;
const MIN_ENGLISH_SHARE = 0.8;

export function isEnglishPassage(text: string): boolean {
  return letterShare(text, LATIN_LETTER) >= MIN_ENGLISH_SHARE;
}

export function passageKind(text: string): PassageKind | null {
  if (isArabicDominant(text)) return "arabic";
  return isEnglishPassage(text) ? "english" : null;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function englishTranslationKey(text: string): string {
  return `en:${createHash("sha256").update(collapse(text)).digest("hex")}`;
}

export function passageTranslationKey(text: string, kind: PassageKind): string {
  return kind === "arabic" ? translationKey(text) : englishTranslationKey(text);
}

export function parseEnglishTranslation(reply: string, english: string): SourceTranslation | null {
  const bangla = cleanTranslation(reply.replace(/^\s*```[a-z]*\s*|\s*```\s*$/gi, ""));
  if (letterShare(bangla, /\p{Script=Bengali}/u) < SOURCE_TRANSLATION_CONFIG.minBengaliRatio) {
    return null;
  }
  if (hasBrokenScript(bangla)) return null;
  return { segments: [{ arabic: "", bangla, english: collapse(english) }] };
}

export async function translateEnglishSource(
  english: string,
  reference: string,
  models: readonly string[] = SOURCE_TRANSLATION_CONFIG.models,
): Promise<SourceTranslation | null> {
  if (collapse(english).length === 0) return null;

  const result = await generateWithPreferredModels(
    "English source translation",
    {
      system: ENGLISH_TRANSLATION_SYSTEM,
      prompt: `উৎস: ${reference}\n\n${collapse(english)}`,
      maxOutputTokens: SOURCE_TRANSLATION_CONFIG.maxOutputTokens,
      timeoutMs: SOURCE_TRANSLATION_CONFIG.timeoutMs,
      headers: BACKGROUND_PRIORITY_HEADERS,
    },
    models,
    true,
  );
  if (!result) return null;

  const translation = parseEnglishTranslation(result.text, english);
  if (!translation) {
    logger.warn("English source translation rejected by validation", {
      reference,
      model: result.modelId,
      replyChars: result.text.length,
    });
    return null;
  }

  await (
    await collection()
  ).replaceOne(
    { _id: englishTranslationKey(english) },
    { ...translation, model: result.modelId, createdAt: new Date() },
    { upsert: true },
  );
  return translation;
}

export function withTranslation(
  chunk: RetrievedChunk,
  translation: SourceTranslation,
): RetrievedChunk {
  const bangla = translation.segments.map((segment) => segment.bangla).join(" ");
  const english = translation.segments.map((segment) => segment.english).join(" ");
  const vocalized = translation.segments
    .map((segment) => segment.vocalized ?? segment.arabic)
    .join("\n");

  return {
    ...chunk,
    content: `${chunk.content.trim()}\n\n${TRANSLATION_LABELS.bangla}: ${bangla}\n\n${TRANSLATION_LABELS.english}: ${english}`,
    vocalized,
    segments: translation.segments,
    machineTranslated: true,
  };
}

const inFlight = new Map<string, Promise<SourceTranslation | null>>();
const failedAt = new Map<string, number>();
let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= SOURCE_TRANSLATION_CONFIG.maxConcurrent) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  running += 1;
  try {
    return await task();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

export function translatePassageOnDemand(
  content: string,
  reference: string,
  kind: PassageKind = "arabic",
): Promise<SourceTranslation | null> {
  const key = passageTranslationKey(content, kind);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const lastFailure = failedAt.get(key);
  if (lastFailure && Date.now() - lastFailure < SOURCE_TRANSLATION_CONFIG.failureCooldownMs) {
    return Promise.resolve(null);
  }

  const job = withSlot(() =>
    kind === "arabic"
      ? translateSource(content, reference)
      : translateEnglishSource(content, reference),
  )
    .then((translation) => {
      if (translation) failedAt.delete(key);
      else failedAt.set(key, Date.now());
      return translation;
    })
    .catch((error: unknown) => {
      failedAt.set(key, Date.now());
      logger.warn("On-demand source translation failed", {
        reference,
        error: String(error).slice(0, 160),
      });
      return null;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, job);
  return job;
}

export function translationCoolingDown(content: string, kind: PassageKind): boolean {
  const lastFailure = failedAt.get(passageTranslationKey(content, kind));
  return (
    lastFailure !== undefined &&
    Date.now() - lastFailure < SOURCE_TRANSLATION_CONFIG.failureCooldownMs
  );
}

export function translateOnDemand(chunk: RetrievedChunk): Promise<SourceTranslation | null> {
  return translatePassageOnDemand(chunk.content, chunk.citation.reference, "arabic");
}

export interface TranslationJobs {
  jobs: Promise<unknown>[];
  results: Map<string, SourceTranslation>;
}

export function startMissingTranslations(context: RetrievedChunk[]): TranslationJobs {
  const results = new Map<string, SourceTranslation>();
  const jobs = context
    .filter(needsTranslation)
    .slice(0, SOURCE_TRANSLATION_CONFIG.maxPerRequest)
    .map((chunk) =>
      translateOnDemand(chunk).then((translation) => {
        if (translation) results.set(chunk.id, translation);
      }),
    );
  return { jobs, results };
}

export async function settleWithin(jobs: Promise<unknown>[], waitMs: number): Promise<void> {
  if (jobs.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled(jobs),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, waitMs);
    }),
  ]);
  clearTimeout(timer);
}

export async function attachSourceTranslations(
  context: RetrievedChunk[],
): Promise<RetrievedChunk[]> {
  const pending = context.filter(needsTranslation);
  if (pending.length === 0) return context;

  const found = await loadTranslations(pending.map((chunk) => translationKey(chunk.content)));

  return context.map((chunk) => {
    if (!needsTranslation(chunk)) return chunk;
    const translation = found.get(translationKey(chunk.content));
    return translation ? withTranslation(chunk, translation) : chunk;
  });
}
