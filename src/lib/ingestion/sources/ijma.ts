import path from "path";
import { loadFileDocuments } from "@/lib/ingestion/sources/fileSource";
import type { IngestionDocument } from "@/types";

const IJMA_DIR = path.join(process.cwd(), "data", "ijma");

export async function loadIjmaDocuments(): Promise<IngestionDocument[]> {
  return loadFileDocuments({ sourceType: "ijma", directory: IJMA_DIR });
}
