import path from "path";
import { loadFileDocuments } from "@/lib/ingestion/sources/fileSource";
import { getRawDocumentUrl } from "@/lib/storage/r2Storage";
import { getStorageEnv } from "@/lib/utils/env";
import type { IngestionDocument } from "@/types";

const IJMA_DIR = path.join(process.cwd(), "data", "ijma");

export async function loadIjmaDocuments(): Promise<IngestionDocument[]> {
  return loadFileDocuments({
    sourceType: "ijma",
    directory: IJMA_DIR,
    buildCitation: (fileName, chunkIndex, r2Key) => ({
      sourceType: "ijma",
      reference: `${path.parse(fileName).name} (অংশ ${chunkIndex + 1})`,
      url: r2Key && getStorageEnv().R2_PUBLIC_BASE_URL ? getRawDocumentUrl(r2Key) : undefined,
    }),
  });
}
