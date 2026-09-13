import { STORAGE_BUDGET } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";

export interface CollectionUsage {
  name: string;
  count: number;
  dataBytes: number;
  indexBytes: number;
}

export interface StorageUsage {
  dataBytes: number;
  indexBytes: number;
  usedBytes: number;
  quotaBytes: number;
  ratio: number;
  collections: CollectionUsage[];
}

export const QUOTA_BYTES = STORAGE_BUDGET.quotaMb * 1024 * 1024;

export function bytesToFree(usedBytes: number, quotaBytes: number = QUOTA_BYTES): number {
  if (usedBytes / quotaBytes < STORAGE_BUDGET.evictAtRatio) return 0;
  return Math.max(0, Math.ceil(usedBytes - quotaBytes * STORAGE_BUDGET.targetRatio));
}

export function describeUsage(usage: Pick<StorageUsage, "usedBytes" | "quotaBytes">): string {
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  const percent = ((usage.usedBytes / usage.quotaBytes) * 100).toFixed(1);
  return `${mb(usage.usedBytes)} MB of ${mb(usage.quotaBytes)} MB (${percent}%)`;
}

export async function storageUsage(): Promise<StorageUsage> {
  const db = await getDb();
  const stats = await db.command({ dbStats: 1, scale: 1 });
  const collections: CollectionUsage[] = [];

  for (const info of await db.listCollections({}, { nameOnly: true }).toArray()) {
    const [row] = await db
      .collection(info.name)
      .aggregate<{ storageStats: { count: number; size: number; totalIndexSize: number } }>([
        { $collStats: { storageStats: { scale: 1 } } },
      ])
      .toArray();

    if (row) {
      collections.push({
        name: info.name,
        count: row.storageStats.count,
        dataBytes: row.storageStats.size,
        indexBytes: row.storageStats.totalIndexSize,
      });
    }
  }

  const dataBytes = Number(stats.dataSize);
  const indexBytes = Number(stats.indexSize);
  const usedBytes = dataBytes + indexBytes;

  return {
    dataBytes,
    indexBytes,
    usedBytes,
    quotaBytes: QUOTA_BYTES,
    ratio: usedBytes / QUOTA_BYTES,
    collections: collections.sort(
      (a, b) => b.dataBytes + b.indexBytes - (a.dataBytes + a.indexBytes),
    ),
  };
}
