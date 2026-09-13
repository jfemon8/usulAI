import path from "path";
import { loadFileDocuments } from "@/lib/ingestion/sources/fileSource";
import type { IngestionDocument } from "@/types";

const QIYAS_DIR = path.join(process.cwd(), "data", "qiyas");

export async function loadQiyasDocuments(): Promise<IngestionDocument[]> {
  return loadFileDocuments({ sourceType: "qiyas", directory: QIYAS_DIR });
}
