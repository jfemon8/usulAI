import "./loadEnv";
import { getMongoClient } from "@/lib/db/mongoClient";
import { describeUsage, storageUsage } from "@/lib/maintenance/storage";

async function main() {
  const usage = await storageUsage();
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2).padStart(8);

  console.log(
    `Used ${describeUsage(usage)}, data ${mb(usage.dataBytes)} MB, indexes ${mb(usage.indexBytes)} MB`,
  );
  console.log("collection                    docs      data MB  index MB");
  for (const row of usage.collections) {
    console.log(
      `${row.name.padEnd(26)}${String(row.count).padStart(8)} ${mb(row.dataBytes)} ${mb(row.indexBytes)}`,
    );
  }

  await (await getMongoClient()).close();
}

void main();
