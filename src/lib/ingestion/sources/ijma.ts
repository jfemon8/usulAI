import path from "path";
import { loadFileDocuments } from "@/lib/ingestion/sources/fileSource";
import { getRawDocumentUrl } from "@/lib/storage";
import type { IngestionDocument } from "@/types";

const IJMA_DIR = path.join(process.cwd(), "data", "ijma");

export async function loadIjmaDocuments(): Promise<IngestionDocument[]> {
  return loadFileDocuments({
    sourceType: "ijma",
    directory: IJMA_DIR,
    buildCitation: (fileName, chunkIndex, storageKey) => ({
      sourceType: "ijma",
      reference: `${path.parse(fileName).name} (অংশ ${chunkIndex + 1})`,
      url: storageKey ? getRawDocumentUrl(storageKey) : undefined,
    }),
  });
}
