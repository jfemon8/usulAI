import path from "path";
import { loadFileDocuments } from "@/lib/ingestion/sources/fileSource";
import { getRawDocumentUrl } from "@/lib/storage/r2Storage";
import { getStorageEnv } from "@/lib/utils/env";
import type { IngestionDocument } from "@/types";

const SIRAT_DIR = path.join(process.cwd(), "data", "sirat");

export async function loadSiratDocuments(): Promise<IngestionDocument[]> {
  return loadFileDocuments({
    sourceType: "sirat",
    directory: SIRAT_DIR,
    buildCitation: (fileName, chunkIndex, r2Key) => ({
      sourceType: "sirat",
      reference: `${path.parse(fileName).name} (অংশ ${chunkIndex + 1})`,
      url: r2Key && getStorageEnv().R2_PUBLIC_BASE_URL ? getRawDocumentUrl(r2Key) : undefined,
    }),
  });
}
