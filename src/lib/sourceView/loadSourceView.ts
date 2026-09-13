import type { ObjectId } from "mongodb";
import {
  ARABIC_TEXT_SOURCES,
  OPENITI_CONFIG,
  SOURCE_PRIORITY,
  SOURCE_TRANSLATION_CONFIG,
  SOURCE_VIEW_CONFIG,
  type OpenItiBook,
} from "@/config/site";
import { describeGrades } from "@/lib/ai/hadithGrade";
import { loadTranslations, translationKey } from "@/lib/ai/sourceTranslation";
import { getDocumentsCollection } from "@/lib/db/mongoClient";
import { splitSourceBlocks, TRANSLATION_LABELS } from "@/lib/ingestion/translations";
import { mergeChunks, pageBlocks, type ViewBlock } from "@/lib/sourceView/pageText";
import type { HadithGrade, SourceCitation, SourceType } from "@/types";

export interface SourceView {
  sourceType: SourceType;
  reference: string;
  title: string;
  details: string[];
  blocks: ViewBlock[];
  attribution?: string;
  externalUrl?: string;
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
  };
}

const SOURCE_TITLES: Record<SourceType, string> = {
  quran: "আল-কুরআন",
  hadith: "হাদিস",
  ijma: "ইজমা",
  qiyas: "কিয়াস",
  sirat: "সীরাত",
};

const OPENITI_BOOKS: readonly OpenItiBook[] = [...OPENITI_CONFIG.ijma, ...OPENITI_CONFIG.qiyas];

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
  const { fileName, page, volume } = row.metadata ?? {};
  if (!fileName || page === undefined) return [row];

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

async function bookView(row: DocumentRow): Promise<SourceView> {
  const rows = await pageRows(row);
  const merged = mergeChunks(
    rows.map((candidate) => candidate.content),
    SOURCE_VIEW_CONFIG.maxChunkOverlapChars,
  );
  const position = rows.findIndex((candidate) => candidate._id.equals(row._id));
  const span = merged.spans[position] ?? { start: 0, end: merged.text.length };
  const book = openItiBook(row.metadata?.fileName);
  const translation = (await loadTranslations([translationKey(row.content)])).get(
    translationKey(row.content),
  );
  const { chapter, page, volume } = row.metadata ?? {};

  const details = [
    ...(book ? [book.author] : []),
    ...(book?.part ? [book.part] : []),
    ...(chapter ? [chapter] : []),
    [
      volume !== undefined ? `খণ্ড ${volume}` : undefined,
      page !== undefined ? `পৃষ্ঠা ${page}` : undefined,
    ]
      .filter(Boolean)
      .join(" · "),
  ].filter((line) => line.length > 0);

  const translated: ViewBlock[] = translation
    ? [
        {
          kind: "text",
          label: `হাইলাইট করা অংশের বাংলা অর্থ (${SOURCE_TRANSLATION_CONFIG.modelLabel})`,
          text: translation.segments.map((segment) => segment.bangla).join(" "),
        },
        {
          kind: "text",
          label: `English meaning (AI translation)`,
          text: translation.segments.map((segment) => segment.english).join(" "),
        },
      ]
    : [];

  return {
    sourceType: row.sourceType,
    reference: row.citation.reference,
    title: book?.title ?? row.citation.reference.split(",")[0] ?? row.citation.reference,
    details,
    blocks: [...pageBlocks(merged.text, span), ...translated],
    ...(book ? { attribution: `OpenITI (KITAB), CC BY-NC-SA 4.0 · ${book.version}` } : {}),
  };
}

export async function loadSourceView(reference: string): Promise<SourceView | null> {
  const collection = await getDocumentsCollection();
  const row = (await collection.findOne(
    { sourceType: { $in: [...SOURCE_PRIORITY] }, "citation.reference": reference },
    { projection: { content: 1, citation: 1, sourceType: 1, metadata: 1 } },
  )) as unknown as DocumentRow | null;

  if (!row) return null;
  return ARABIC_TEXT_SOURCES.includes(row.sourceType) ? bookView(row) : scriptureView(row);
}
