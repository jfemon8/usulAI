import { OPENITI_CONFIG, PUBLIC_DOMAIN_BOOKS, STORAGE_CONFIG } from "@/config/site";
import type { HadithGrade, SourceCitation, SourceType } from "@/types";

type Metadata = Record<string, unknown>;

export type StoredCitation = Omit<SourceCitation, "sourceType"> & { sourceType?: SourceType };

const TITLE_SEPARATOR = ", ";
const REFERENCE_TAIL = /(?:, খণ্ড \d+)?(?:, পৃষ্ঠা \d+)?(?:, অংশ \d+)?(?: \(\d+\))?$/u;

const BOOK_TITLES = new Map<string, string>(
  [
    ...OPENITI_CONFIG.ijma,
    ...OPENITI_CONFIG.qiyas,
    ...OPENITI_CONFIG.sirat,
    ...OPENITI_CONFIG.fiqh,
    ...PUBLIC_DOMAIN_BOOKS,
  ].map((book) => [`${book.slug}.md`, book.title]),
);

export const GRADERS = [
  "Al-Albani",
  "Zubair Ali Zai",
  "Shuaib Al Arnaut",
  "Muhammad Muhyi Al-Din Abdul Hamid",
  "Ahmad Muhammad Shakir",
  "Bashar Awad Maarouf",
  "Salim al-Hilali",
  "Abu Ghuddah",
  "Muhammad Fouad Abd al-Baqi",
] as const;

const GRADE_SEPARATOR = "|";

export function bookFileNames(): string[] {
  return [...BOOK_TITLES.keys()];
}

export function rawSourceKey(sourceType: SourceType, fileName: string): string {
  return `${STORAGE_CONFIG.rawSourcesPrefix}/${sourceType}/${fileName}`;
}

function quranUrl(metadata: Metadata): string | undefined {
  return typeof metadata.surah === "number" && typeof metadata.ayah === "number"
    ? `https://quran.com/${metadata.surah}/${metadata.ayah}`
    : undefined;
}

function derivableBookUrl(url: string, sourceType: SourceType, metadata: Metadata): boolean {
  return (
    typeof metadata.fileName === "string" &&
    metadata.restricted !== true &&
    !url.includes("#") &&
    url.includes(`/${rawSourceKey(sourceType, metadata.fileName)}`)
  );
}

function titlePrefix(metadata: Metadata): string | undefined {
  if (typeof metadata.fileName !== "string" || metadata.restricted === true) return undefined;
  const title = BOOK_TITLES.get(metadata.fileName);
  return title ? `${title}${TITLE_SEPARATOR}` : undefined;
}

export function storedReference(reference: string, metadata: Metadata = {}): string {
  const prefix = titlePrefix(metadata);
  return prefix && reference.startsWith(prefix) && reference.length > prefix.length
    ? reference.slice(prefix.length)
    : reference;
}

export function hydrateReference(reference: string, metadata: Metadata = {}): string {
  const prefix = titlePrefix(metadata);
  return prefix && !reference.startsWith(prefix) ? `${prefix}${reference}` : reference;
}

export function chapterFromReference(reference: string, metadata: Metadata): string | undefined {
  const prefix = titlePrefix(metadata);
  const full = hydrateReference(reference, metadata);
  if (!prefix || !full.startsWith(prefix)) return undefined;
  const chapter = full.slice(prefix.length).replace(REFERENCE_TAIL, "");
  return chapter.length > 0 ? chapter : undefined;
}

export function encodeGrades(grades: readonly HadithGrade[]): string[] {
  return grades.map((entry) => {
    const code = GRADERS.indexOf(entry.name as (typeof GRADERS)[number]);
    return `${code >= 0 ? code : entry.name}${GRADE_SEPARATOR}${entry.grade}`;
  });
}

export function decodeGrades(value: unknown): HadithGrade[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const grades = value.flatMap((entry): HadithGrade[] => {
    if (typeof entry === "string") {
      const split = entry.indexOf(GRADE_SEPARATOR);
      if (split < 0) return [];
      const key = entry.slice(0, split);
      const name = /^\d+$/.test(key) ? (GRADERS[Number(key)] ?? key) : key;
      return [{ name, grade: entry.slice(split + 1) }];
    }
    if (entry && typeof entry === "object") {
      const { name, grade } = entry as Partial<HadithGrade>;
      return typeof name === "string" && typeof grade === "string" ? [{ name, grade }] : [];
    }
    return [];
  });
  return grades.length > 0 ? grades : undefined;
}

function isEncodable(value: unknown): value is HadithGrade[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        typeof (entry as HadithGrade).name === "string" &&
        typeof (entry as HadithGrade).grade === "string",
    )
  );
}

export function storedCitation(
  citation: SourceCitation,
  sourceType: SourceType,
  metadata: Metadata = {},
): StoredCitation {
  const stored: StoredCitation = {
    ...citation,
    reference: storedReference(citation.reference, metadata),
  };

  if (stored.sourceType === sourceType) delete stored.sourceType;
  if (stored.page !== undefined && stored.page === metadata.page) delete stored.page;
  if (stored.url === null) delete stored.url;
  if (
    stored.url !== undefined &&
    (stored.url === quranUrl(metadata) || derivableBookUrl(stored.url, sourceType, metadata))
  ) {
    delete stored.url;
  }

  return stored;
}

export function storedMetadata(
  metadata: Metadata,
  sourceType: SourceType,
  reference?: string,
): Metadata {
  const stored = { ...metadata };

  if (
    typeof stored.fileName === "string" &&
    stored.restricted !== true &&
    (stored.storageKey === rawSourceKey(sourceType, stored.fileName) || stored.storageKey === null)
  ) {
    delete stored.storageKey;
  }

  if (
    reference !== undefined &&
    typeof stored.chapter === "string" &&
    chapterFromReference(reference, stored) === stored.chapter
  ) {
    delete stored.chapter;
  }

  if (isEncodable(stored.grades)) stored.grades = encodeGrades(stored.grades);

  return stored;
}

export function hydrateMetadata(metadata: Metadata = {}, reference?: string): Metadata {
  const hydrated = { ...metadata };
  if (hydrated.chapter === undefined && reference !== undefined) {
    const chapter = chapterFromReference(reference, hydrated);
    if (chapter !== undefined) hydrated.chapter = chapter;
  }
  const grades = decodeGrades(hydrated.grades);
  if (grades) hydrated.grades = grades;
  return hydrated;
}

export function hydrateCitation(
  citation: StoredCitation,
  sourceType: SourceType,
  metadata: Metadata = {},
): SourceCitation {
  const page = citation.page ?? (typeof metadata.page === "number" ? metadata.page : undefined);
  const url = citation.url ?? (sourceType === "quran" ? quranUrl(metadata) : undefined);

  return {
    ...citation,
    reference: hydrateReference(citation.reference, metadata),
    sourceType,
    ...(page !== undefined ? { page } : {}),
    ...(url !== undefined ? { url } : {}),
  };
}

export interface ReferenceFilter {
  "citation.reference": string | { $in: string[] };
  "metadata.fileName"?: string;
}

export function referenceFilters(references: readonly string[]): ReferenceFilter[] {
  const whole: string[] = [];
  const byFile = new Map<string, string[]>();

  for (const reference of references) {
    whole.push(reference);
    for (const [fileName, title] of BOOK_TITLES) {
      const prefix = `${title}${TITLE_SEPARATOR}`;
      if (!reference.startsWith(prefix) || reference.length === prefix.length) continue;
      byFile.set(fileName, [...(byFile.get(fileName) ?? []), reference.slice(prefix.length)]);
    }
  }

  return [
    ...(whole.length > 0 ? [{ "citation.reference": { $in: whole } }] : []),
    ...[...byFile].map(([fileName, suffixes]) => ({
      "metadata.fileName": fileName,
      "citation.reference": { $in: suffixes },
    })),
  ];
}

export const HYDRATION_PROJECTION = {
  "metadata.page": 1,
  "metadata.surah": 1,
  "metadata.ayah": 1,
  "metadata.fileName": 1,
  "metadata.restricted": 1,
} as const;
