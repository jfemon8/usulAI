import path from "path";
import { loadFileDocuments, type LoaderOptions } from "@/lib/ingestion/sources/fileSource";
import type { IngestionDocument } from "@/types";

const IJMA_DIR = path.join(process.cwd(), "data", "ijma");

export async function loadIjmaDocuments(options: LoaderOptions = {}): Promise<IngestionDocument[]> {
  return loadFileDocuments({
    sourceType: "ijma",
    directory: IJMA_DIR,
    archiveRawFile: options.archive ?? true,
  });
}
