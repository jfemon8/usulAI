import type { ObjectId } from "mongodb";
import { hydrateCitation } from "@/lib/db/documentShape";
import {
  ARABIC_TEXT_SOURCES,
  OPENITI_CONFIG,
  PUBLIC_DOMAIN_BOOKS,
  SOURCE_PRIORITY,
  SOURCE_TRANSLATION_CONFIG,
  SOURCE_VIEW_CONFIG,
  type OpenItiBook,
} from "@/config/site";
import { describeGrades } from "@/lib/ai/hadithGrade";
import {
  loadTranslations,
  passageKind,
  passageTranslationKey,
  translatePassageOnDemand,
  type SourceTranslation,
} from "@/lib/ai/sourceTranslation";
import { runAfterResponse } from "@/lib/utils/afterResponse";
import { getDocumentsCollection } from "@/lib/db/mongoClient";
import { splitSourceBlocks, TRANSLATION_LABELS } from "@/lib/ingestion/translations";
import { isArabicText, mergeChunks, pageBlocks, type ViewBlock } from "@/lib/sourceView/pageText";
import type { HadithGrade, SourceCitation, SourceType } from "@/types";

export interface SourceView {
  sourceType: SourceType;
  reference: string;
  title: string;
  details: string[];
  blocks: ViewBlock[];
  attribution?: string;
  externalUrl?: string;
  translationPending?: boolean;
}

export interface SourceViewOptions {
  translationWaitMs?: number;
}

interface DocumentRow {
  _id: ObjectId;
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  metadata?: {
    fileName?: string;
    chapter?: string;
    page?: number;
    volume?: number;
    grades?: HadithGrade[];
    restricted?: boolean;
  };
}

const SOURCE_TITLES: Record<SourceType, string> = {
  quran: "আল-কুরআন",
  hadith: "হাদিস",
  ijma: "ইজমা",
  qiyas: "কিয়াস",
  sirat: "সীরাত ও জীবনী",
  fiqh: "ফিকহ ও ফতোয়া",
};

const OPENITI_BOOKS: readonly OpenItiBook[] = [
  ...OPENITI_CONFIG.ijma,
  ...OPENITI_CONFIG.qiyas,
  ...OPENITI_CONFIG.sirat,
  ...OPENITI_CONFIG.fiqh,
];

function openItiBook(fileName: string | undefined): OpenItiBook | undefined {
  return OPENITI_BOOKS.find((book) => `${book.slug}.md` === fileName);
}

function scriptureView(row: DocumentRow): SourceView {
  const blocks = splitSourceBlocks(row.content);
  const grades = describeGrades(row.metadata?.grades);
  const details = [
    SOURCE_TITLES[row.sourceType],
    ...(row.metadata?.chapter ? [row.metadata.chapter] : []),
    ...(grades ? [`মান: ${grades}`] : []),
  ];

  return {
    sourceType: row.sourceType,
    reference: row.citation.reference,
    title: row.citation.reference,
    details,
    blocks: [
      ...(blocks.arabic ? [{ kind: "arabic" as const, text: blocks.arabic, highlight: true }] : []),
      ...(blocks.bangla
        ? [{ kind: "text" as const, label: "বাংলা অনুবাদ", text: blocks.bangla, highlight: true }]
        : []),
      ...(blocks.english
        ? [
            {
              kind: "text" as const,
              label: TRANSLATION_LABELS.english,
              text: blocks.english,
              highlight: true,
            },
          ]
        : []),
    ],
    ...(row.citation.url?.startsWith("https://quran.com/")
      ? { externalUrl: row.citation.url }
      : {}),
  };
}

async function pageRows(row: DocumentRow): Promise<DocumentRow[]> {
  const { fileName, page, volume, restricted } = row.metadata ?? {};
  if (restricted || !fileName || page === undefined) return [row];

  const collection = await getDocumentsCollection();
  const rows = (await collection
    .find(
      {
        sourceType: row.sourceType,
        "metadata.fileName": fileName,
        "metadata.page": page,
        "metadata.volume": volume ?? { $exists: false },
      } as never,
      { projection: { content: 1, citation: 1, sourceType: 1, metadata: 1 } },
    )
    .sort({ _id: 1 })
    .toArray()) as unknown as DocumentRow[];

  return rows.some((candidate) => candidate._id.equals(row._id)) ? rows : [row];
}

async function within<T>(job: Promise<T>, waitMs: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    job,
    new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), waitMs);
    }),
  ]);
  clearTimeout(timer);
  return result;
}

async function passageTranslation(
  row: DocumentRow,
  waitMs: number,
): Promise<{
  translation?: SourceTranslation;
  pending: boolean;
  kind: "arabic" | "english" | null;
}> {
  const kind = row.metadata?.restricted ? null : passageKind(row.content);
  if (!kind) return { pending: false, kind };

  const key = passageTranslationKey(row.content, kind);
  const cached = (await loadTranslations([key])).get(key);
  if (cached) return { translation: cached, pending: false, kind };
  if (waitMs <= 0) return { pending: true, kind };

  const job = translatePassageOnDemand(row.content, row.citation.reference, kind);
  const translation = (await within(job, waitMs)) ?? undefined;
  if (!translation) runAfterResponse(() => job);
  return translation ? { translation, pending: false, kind } : { pending: true, kind };
}

async function bookView(row: DocumentRow, options: SourceViewOptions): Promise<SourceView> {
  const rows = await pageRows(row);
  const sections = rows.reduce<DocumentRow[][]>((groups, candidate) => {
    const last = groups[groups.length - 1];
    if (last && last[0]?.metadata?.chapter === candidate.metadata?.chapter) last.push(candidate);
    else groups.push([candidate]);
    return groups;
  }, []);

  const pageContent = sections.flatMap((section, index): ViewBlock[] => {
    const merged = mergeChunks(
      section.map((candidate) => candidate.content),
      SOURCE_VIEW_CONFIG.maxChunkOverlapChars,
      SOURCE_VIEW_CONFIG.minChunkOverlapChars,
    );
    const position = section.findIndex((candidate) => candidate._id.equals(row._id));
    const span = position >= 0 ? (merged.spans[position] ?? null) : null;
    const title = section[0]?.metadata?.chapter;
    const heading: ViewBlock[] =
      title && (index > 0 || title !== row.metadata?.chapter)
        ? [{ kind: isArabicText(title) ? "arabic" : "text", text: title, heading: true }]
        : [];
    return [...heading, ...pageBlocks(merged.text, span)];
  });
  const book = openItiBook(row.metadata?.fileName);
  const publicBook = PUBLIC_DOMAIN_BOOKS.find(
    (candidate) => `${candidate.slug}.md` === row.metadata?.fileName,
  );
  const { translation, pending, kind } = await passageTranslation(
    row,
    options.translationWaitMs ?? SOURCE_VIEW_CONFIG.translationWaitMs,
  );
  const { chapter, page, volume } = row.metadata ?? {};

  const details = [
    ...(book ? [book.author] : []),
    ...(publicBook ? [publicBook.author, publicBook.note] : []),
    ...(book?.part ? [book.part] : []),
    ...(chapter ? [chapter] : []),
    [
      volume !== undefined ? `খণ্ড ${volume}` : undefined,
      page !== undefined ? `পৃষ্ঠা ${page}` : undefined,
    ]
      .filter(Boolean)
      .join(" · "),
  ].filter((line) => line.length > 0);

  const banglaMeaning: ViewBlock[] = translation
    ? [
        {
          kind: "text",
          label: `হাইলাইট করা অংশের বাংলা অর্থ (${SOURCE_TRANSLATION_CONFIG.modelLabel})`,
          text: translation.segments.map((segment) => segment.bangla).join(" "),
        },
      ]
    : [];
  const englishMeaning: ViewBlock[] =
    translation && kind === "arabic"
      ? [
          {
            kind: "text",
            label: `English meaning (AI translation)`,
            text: translation.segments.map((segment) => segment.english).join(" "),
          },
        ]
      : [];
  const pendingNote: ViewBlock[] = pending
    ? [
        {
          kind: "text",
          label: `হাইলাইট করা অংশের বাংলা অর্থ (${SOURCE_TRANSLATION_CONFIG.modelLabel})`,
          text: "অর্থ এখনো তৈরি হয়নি। কিছুক্ষণ পরে সূত্রটি আবার খুললে অর্থ দেখা যাবে।",
        },
      ]
    : [];
  const translated = [...banglaMeaning, ...englishMeaning, ...pendingNote];

  return {
    sourceType: row.sourceType,
    reference: row.citation.reference,
    title:
      book?.title ??
      publicBook?.title ??
      row.citation.reference.split(",")[0] ??
      row.citation.reference,
    details,
    blocks: [...pageContent, ...translated],
    ...(pending ? { translationPending: true } : {}),
    ...(book
      ? { attribution: `OpenITI (KITAB), CC BY-NC-SA 4.0 · ${book.version}` }
      : publicBook
        ? { attribution: publicBook.license }
        : row.metadata?.restricted
          ? { attribution: "উত্তরে ব্যবহৃত সংক্ষিপ্ত উদ্ধৃতি, স্বত্ব প্রকাশক ও লেখকের" }
          : {}),
  };
}

export async function loadSourceView(
  reference: string,
  options: SourceViewOptions = {},
): Promise<SourceView | null> {
  const collection = await getDocumentsCollection();
  const row = (await collection.findOne(
    { sourceType: { $in: [...SOURCE_PRIORITY] }, "citation.reference": reference },
    { projection: { content: 1, citation: 1, sourceType: 1, metadata: 1 } },
  )) as unknown as DocumentRow | null;

  if (!row) return null;
  const hydrated: DocumentRow = {
    ...row,
    citation: hydrateCitation(row.citation, row.sourceType, row.metadata),
  };
  return ARABIC_TEXT_SOURCES.includes(row.sourceType)
    ? bookView(hydrated, options)
    : scriptureView(hydrated);
}
