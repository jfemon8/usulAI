import { alquranCloudProvider } from "@/lib/ingestion/sources/providers/quran/alquranCloud";
import { fawazahmed0QuranProvider } from "@/lib/ingestion/sources/providers/quran/fawazahmed0";
import { quranComProvider } from "@/lib/ingestion/sources/providers/quran/quranCom";
import { runProviderChain } from "@/lib/ingestion/sources/providers/runProviderChain";
import type { CorpusProvider } from "@/lib/ingestion/sources/providers/types";
import type { IngestionDocument } from "@/types";

export const QURAN_PROVIDERS: readonly CorpusProvider[] = [
  alquranCloudProvider,
  quranComProvider,
  fawazahmed0QuranProvider,
];

export async function fetchQuranCorpus(): Promise<IngestionDocument[]> {
  return runProviderChain("quran", QURAN_PROVIDERS);
}
