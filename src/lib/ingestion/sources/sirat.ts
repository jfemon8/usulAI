import path from "path";
import { loadFileDocuments } from "@/lib/ingestion/sources/fileSource";
import type { IngestionDocument } from "@/types";

const SIRAT_DIR = path.join(process.cwd(), "data", "sirat");

export async function loadSiratDocuments(): Promise<IngestionDocument[]> {
  return loadFileDocuments({ sourceType: "sirat", directory: SIRAT_DIR });
}
