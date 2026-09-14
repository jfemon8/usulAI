import path from "path";
import { loadFileDocuments, type LoaderOptions } from "@/lib/ingestion/sources/fileSource";
import type { IngestionDocument } from "@/types";

const FIQH_DIR = path.join(process.cwd(), "data", "fiqh");

export async function loadFiqhDocuments(
  options: LoaderOptions = {},
): Promise<IngestionDocument[]> {
  return loadFileDocuments({
    sourceType: "fiqh",
    directory: FIQH_DIR,
    archiveRawFile: options.archive ?? true,
  });
}
