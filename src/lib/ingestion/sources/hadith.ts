import { fawazahmed0HadithProvider } from "@/lib/ingestion/sources/providers/hadith/fawazahmed0";
import { hadithApiComProvider } from "@/lib/ingestion/sources/providers/hadith/hadithApiCom";
import { sunnahComProvider } from "@/lib/ingestion/sources/providers/hadith/sunnahCom";
import { runProviderChain } from "@/lib/ingestion/sources/providers/runProviderChain";
import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";
import type { IngestionDocument } from "@/types";

export const HADITH_PROVIDERS: readonly CorpusProvider[] = [
  hadithApiComProvider,
  sunnahComProvider,
  fawazahmed0HadithProvider,
];

export async function fetchHadithCorpus(): Promise<IngestionDocument[]> {
  return runProviderChain("hadith", HADITH_PROVIDERS);
}
