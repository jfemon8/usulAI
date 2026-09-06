import { readdir, readFile } from "fs/promises";
import path from "path";
import { parsePdf } from "@/lib/ingestion/parsers/pdfParser";
import { parseDocx } from "@/lib/ingestion/parsers/docxParser";
import { parsePlainText } from "@/lib/ingestion/parsers/textParser";
import { chunkText } from "@/lib/ingestion/chunker";
import { uploadRawDocument } from "@/lib/storage/r2Storage";
import { logger } from "@/lib/utils/logger";
import type { IngestionDocument, SourceCitation, SourceType } from "@/types";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

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
  buildCitation: (fileName: string, chunkIndex: number, r2Key: string | null) => SourceCitation;
  archiveToR2?: boolean;
}

export async function loadFileDocuments({
  sourceType,
  directory,
  buildCitation,
  archiveToR2 = true,
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

    let r2Key: string | null = null;

    if (archiveToR2) {
      try {
        r2Key = await uploadRawDocument(
          `${sourceType}/${file}`,
          buffer,
          CONTENT_TYPES[extension] ?? "application/octet-stream",
        );
      } catch (error) {
        logger.warn(`R2 archive failed for "${file}", continuing without it`, {
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
        citation: buildCitation(file, index, r2Key),
        metadata: { fileName: file, chunkIndex: index, chunkCount: chunks.length, r2Key },
      });
    });
  }

  return documents;
}
