import { DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import type { IngestionDocument, SourceType } from "@/types";

export function countProviders(documents: IngestionDocument[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const document of documents) {
    const provider = document.provenance ?? "file";
    counts[provider] = (counts[provider] ?? 0) + 1;
  }
  return counts;
}

function safeKey(provider: string): string {
  return provider.replace(/[.$]/g, "_");
}

export async function recordProvenance(
  sourceType: SourceType | string,
  counts: Record<string, number>,
  options: { replace: boolean },
): Promise<void> {
  if (Object.keys(counts).length === 0) return;

  const entries = Object.entries(counts).map(([provider, count]) => [safeKey(provider), count]);
  const update = options.replace
    ? { providers: Object.fromEntries(entries), updatedAt: new Date() }
    : {
        ...Object.fromEntries(entries.map(([key, count]) => [`providers.${key}`, count])),
        updatedAt: new Date(),
      };

  const db = await getDb();
  await db
    .collection<{ _id: string }>(DB_CONFIG.corpusSourcesCollection)
    .updateOne({ _id: sourceType }, { $set: update }, { upsert: true });
}
