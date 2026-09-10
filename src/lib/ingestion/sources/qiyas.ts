import path from "path";
import { loadFileDocuments } from "@/lib/ingestion/sources/fileSource";
import { getRawDocumentUrl } from "@/lib/storage";
import type { IngestionDocument } from "@/types";

const QIYAS_DIR = path.join(process.cwd(), "data", "qiyas");

export async function loadQiyasDocuments(): Promise<IngestionDocument[]> {
  return loadFileDocuments({
    sourceType: "qiyas",
    directory: QIYAS_DIR,
    buildCitation: (fileName, chunkIndex, storageKey) => ({
      sourceType: "qiyas",
      reference: `${path.parse(fileName).name} (অংশ ${chunkIndex + 1})`,
      url: storageKey ? getRawDocumentUrl(storageKey) : undefined,
    }),
  });
}
