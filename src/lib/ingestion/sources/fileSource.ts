import { readdir, readFile } from "fs/promises";
import path from "path";
import { parsePdf } from "@/lib/ingestion/parsers/pdfParser";
import { parseDocx } from "@/lib/ingestion/parsers/docxParser";
import { parsePlainText } from "@/lib/ingestion/parsers/textParser";
import { chunkText } from "@/lib/ingestion/chunker";
import { uploadRawDocument } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import type { IngestionDocument, SourceCitation, SourceType } from "@/types";

const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".md"]);

async function parseByExtension(extension: string, buffer: Buffer): Promise<string | null> {
  if (extension === ".pdf") return parsePdf(buffer);
  if (extension === ".docx") return parseDocx(buffer);
  if (PLAIN_TEXT_EXTENSIONS.has(extension)) return parsePlainText(buffer);
  return null;
}

export interface FileSourceOptions {
  sourceType: SourceType;
  directory: string;
  buildCitation: (
    fileName: string,
    chunkIndex: number,
    storageKey: string | null,
  ) => SourceCitation;
  archiveRawFile?: boolean;
}

export async function loadFileDocuments({
  sourceType,
  directory,
  buildCitation,
  archiveRawFile = true,
}: FileSourceOptions): Promise<IngestionDocument[]> {
  const files = await readdir(directory).catch(() => []);
  const documents: IngestionDocument[] = [];

  for (const file of files) {
    if (file.startsWith(".")) continue;

    const extension = path.extname(file).toLowerCase();
    const buffer = await readFile(path.join(directory, file));
    if (extension === ".doc") {
      logger.warn(`Skipped "${file}" — legacy .doc is unsupported, convert it to .docx`, {
        sourceType,
      });
      continue;
    }

    const text = await parseByExtension(extension, buffer);

    if (!text || text.trim().length === 0) {
      logger.warn(`Skipped "${file}" — no extractable text`, { sourceType });
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

    const chunks = chunkText(text);

    chunks.forEach((chunk, index) => {
      documents.push({
        sourceType,
        content: chunk,
        citation: buildCitation(file, index, storageKey),
        metadata: { fileName: file, chunkIndex: index, chunkCount: chunks.length, storageKey },
      });
    });
  }

  return documents;
}
