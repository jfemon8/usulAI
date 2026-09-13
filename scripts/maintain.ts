import "./loadEnv";
import { getMongoClient } from "@/lib/db/mongoClient";
import { runMaintenance } from "@/lib/maintenance/retention";

async function main() {
  const report = await runMaintenance({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(report, null, 2));
  await (await getMongoClient()).close();
}

void main();
