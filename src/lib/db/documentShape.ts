import { STORAGE_CONFIG } from "@/config/site";
import type { SourceCitation, SourceType } from "@/types";

type Metadata = Record<string, unknown>;

export type StoredCitation = Omit<SourceCitation, "sourceType"> & { sourceType?: SourceType };

export function rawSourceKey(sourceType: SourceType, fileName: string): string {
  return `${STORAGE_CONFIG.rawSourcesPrefix}/${sourceType}/${fileName}`;
}

function quranUrl(metadata: Metadata): string | undefined {
  return typeof metadata.surah === "number" && typeof metadata.ayah === "number"
    ? `https://quran.com/${metadata.surah}/${metadata.ayah}`
    : undefined;
}

function derivableBookUrl(url: string, sourceType: SourceType, metadata: Metadata): boolean {
  return (
    typeof metadata.fileName === "string" &&
    metadata.restricted !== true &&
    !url.includes("#") &&
    url.includes(`/${rawSourceKey(sourceType, metadata.fileName)}`)
  );
}

export function storedCitation(
  citation: SourceCitation,
  sourceType: SourceType,
  metadata: Metadata = {},
): StoredCitation {
  const stored: StoredCitation = { ...citation };

  if (stored.sourceType === sourceType) delete stored.sourceType;
  if (stored.page !== undefined && stored.page === metadata.page) delete stored.page;
  if (
    stored.url !== undefined &&
    (stored.url === quranUrl(metadata) || derivableBookUrl(stored.url, sourceType, metadata))
  ) {
    delete stored.url;
  }

  return stored;
}

export function storedMetadata(metadata: Metadata, sourceType: SourceType): Metadata {
  const stored = { ...metadata };

  if (
    typeof stored.fileName === "string" &&
    stored.restricted !== true &&
    (stored.storageKey === rawSourceKey(sourceType, stored.fileName) || stored.storageKey === null)
  ) {
    delete stored.storageKey;
  }

  return stored;
}

export function hydrateCitation(
  citation: StoredCitation,
  sourceType: SourceType,
  metadata: Metadata = {},
): SourceCitation {
  const page = citation.page ?? (typeof metadata.page === "number" ? metadata.page : undefined);
  const url = citation.url ?? (sourceType === "quran" ? quranUrl(metadata) : undefined);

  return {
    ...citation,
    sourceType,
    ...(page !== undefined ? { page } : {}),
    ...(url !== undefined ? { url } : {}),
  };
}

export const HYDRATION_PROJECTION = {
  "metadata.page": 1,
  "metadata.surah": 1,
  "metadata.ayah": 1,
} as const;
