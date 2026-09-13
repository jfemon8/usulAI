import { readdir, readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { parsePdfPages } from "@/lib/ingestion/parsers/pdfParser";
import { parseDocxHtml } from "@/lib/ingestion/parsers/docxParser";
import { parsePlainText } from "@/lib/ingestion/parsers/textParser";
import { chunkText } from "@/lib/ingestion/chunker";
import {
  formatBookReference,
  sectionsFromHtml,
  sectionsFromPdfPages,
  sectionsFromPlainText,
  type BookLocation,
  type BookMetadata,
  type BookSection,
} from "@/lib/ingestion/sources/bookStructure";
import { getRawDocumentUrl, uploadRawDocument } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import type { IngestionDocument, SourceCitation, SourceType } from "@/types";

const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".md"]);
const METADATA_EXTENSION = ".json";

const metadataSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  translator: z.string().optional(),
  publisher: z.string().optional(),
  edition: z.string().optional(),
  year: z.union([z.string(), z.number()]).transform(String).optional(),
  license: z.string().optional(),
  source: z.string().optional(),
  pageOffset: z.number().int().optional(),
  chapters: z.array(z.object({ title: z.string().min(1), page: z.number().int() })).optional(),
});

export interface CitationInput extends BookLocation {
  fileName: string;
  physicalPage?: number;
  storageKey: string | null;
}

export interface LoaderOptions {
  archive?: boolean;
}

export interface FileSourceOptions {
  sourceType: SourceType;
  directory: string;
  buildCitation?: (input: CitationInput) => SourceCitation;
  archiveRawFile?: boolean;
}

export function defaultBookCitation(sourceType: SourceType) {
  return (input: CitationInput): SourceCitation => {
    const base = input.storageKey ? getRawDocumentUrl(input.storageKey) : undefined;
    const url =
      base && input.physicalPage !== undefined ? `${base}#page=${input.physicalPage}` : base;

    return {
      sourceType,
      reference: formatBookReference(input),
      url,
      ...(input.page !== undefined ? { page: input.page } : {}),
    };
  };
}

async function readMetadata(directory: string, file: string): Promise<BookMetadata> {
  const candidates = [
    `${file}${METADATA_EXTENSION}`,
    `${path.parse(file).name}${METADATA_EXTENSION}`,
  ];

  for (const candidate of candidates) {
    const raw = await readFile(path.join(directory, candidate), "utf8").catch(() => null);
    if (raw === null) continue;

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      logger.warn(`Ignored book metadata "${candidate}": not valid JSON`);
      continue;
    }

    const parsed = metadataSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    logger.warn(`Ignored invalid book metadata "${candidate}"`, {
      error: parsed.error.message.slice(0, 200),
    });
  }

  return {};
}

async function sectionsFor(
  extension: string,
  buffer: Buffer,
  file: string,
  metadata: BookMetadata,
  sourceType: SourceType,
): Promise<BookSection[] | null> {
  if (extension === ".pdf") {
    const pages = await parsePdfPages(buffer);
    const { sections, blankPages } = sectionsFromPdfPages(pages, metadata);

    if (blankPages.length === pages.length) {
      logger.warn(
        `Skipped "${file}": none of its ${pages.length} pages has a text layer, so it is a scanned PDF and needs OCR`,
        { sourceType },
      );
      return null;
    }

    if (blankPages.length > 0) {
      logger.warn(
        `"${file}": ${blankPages.length} of ${pages.length} pages have no text layer and were not ingested (pages ${blankPages.slice(0, 12).join(", ")}${blankPages.length > 12 ? ", ..." : ""})`,
        { sourceType },
      );
    }

    return sections;
  }

  if (extension === ".docx") return sectionsFromHtml(await parseDocxHtml(buffer));
  if (PLAIN_TEXT_EXTENSIONS.has(extension)) return sectionsFromPlainText(parsePlainText(buffer));
  return null;
}

export async function loadFileDocuments({
  sourceType,
  directory,
  buildCitation = defaultBookCitation(sourceType),
  archiveRawFile = true,
}: FileSourceOptions): Promise<IngestionDocument[]> {
  const files = await readdir(directory).catch(() => []);
  const documents: IngestionDocument[] = [];
  const seen = new Map<string, number>();

  for (const file of files) {
    if (file.startsWith(".")) continue;

    const extension = path.extname(file).toLowerCase();
    if (extension === METADATA_EXTENSION) continue;

    if (extension === ".doc") {
      logger.warn(`Skipped "${file}": legacy .doc is unsupported, convert it to .docx`, {
        sourceType,
      });
      continue;
    }

    const buffer = await readFile(path.join(directory, file));
    const metadata = await readMetadata(directory, file);
    const sections = await sectionsFor(extension, buffer, file, metadata, sourceType);

    if (sections === null) {
      if (extension !== ".pdf") {
        logger.warn(`Skipped "${file}": unsupported file type`, { sourceType });
      }
      continue;
    }

    if (sections.length === 0) {
      logger.warn(`Skipped "${file}": no extractable text`, { sourceType });
      continue;
    }

    let storageKey: string | null = null;

    if (archiveRawFile) {
      try {
        storageKey = await uploadRawDocument(`${sourceType}/${file}`, buffer);
      } catch (error) {
        logger.warn(`Raw file archive failed for "${file}", continuing without it`, {
          sourceType,
          error: String(error),
        });
      }
    }

    const title = metadata.title ?? path.parse(file).name;
    const offset = metadata.pageOffset ?? 0;

    for (const section of sections) {
      const chunks = chunkText(section.text);

      chunks.forEach((chunk, index) => {
        const citation = buildCitation({
          title,
          chapter: section.chapter,
          volume: section.volume,
          page: section.page,
          physicalPage:
            extension === ".pdf" && section.page !== undefined ? section.page - offset : undefined,
          part: index + 1,
          partCount: chunks.length,
          fileName: file,
          storageKey,
        });

        const repeats = (seen.get(citation.reference) ?? 0) + 1;
        seen.set(citation.reference, repeats);
        if (repeats > 1) citation.reference = `${citation.reference} (${repeats})`;

        documents.push({
          sourceType,
          content: chunk,
          citation,
          metadata: {
            fileName: file,
            ...(section.chapter ? { chapter: section.chapter } : {}),
            ...(section.volume !== undefined ? { volume: section.volume } : {}),
            ...(section.page !== undefined ? { page: section.page } : {}),
            storageKey,
          },
          provenance: [title, metadata.author, metadata.edition].filter(Boolean).join(" | "),
        });
      });
    }
  }

  return documents;
}
