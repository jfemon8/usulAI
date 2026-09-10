import path from "path";
import { loadFileDocuments } from "@/lib/ingestion/sources/fileSource";
import { getRawDocumentUrl } from "@/lib/storage";
import type { IngestionDocument } from "@/types";

const SIRAT_DIR = path.join(process.cwd(), "data", "sirat");

export async function loadSiratDocuments(): Promise<IngestionDocument[]> {
  return loadFileDocuments({
    sourceType: "sirat",
    directory: SIRAT_DIR,
    buildCitation: (fileName, chunkIndex, storageKey) => ({
      sourceType: "sirat",
      reference: `${path.parse(fileName).name} (অংশ ${chunkIndex + 1})`,
      url: storageKey ? getRawDocumentUrl(storageKey) : undefined,
    }),
  });
}
