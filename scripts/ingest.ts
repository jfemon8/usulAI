import "./loadEnv";
import { SOURCE_PRIORITY } from "@/config/site";
import { getMongoClient } from "@/lib/db/mongoClient";
import { runIngestion } from "@/lib/ingestion/runIngestion";
import type { SourceType } from "@/types";

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const named = argv.filter((arg) => !arg.startsWith("--")) as SourceType[];
  const unknown = named.filter((source) => !SOURCE_PRIORITY.includes(source));

  if (unknown.length > 0) {
    throw new Error(
      `Unknown source(s): ${unknown.join(", ")}. Valid: ${SOURCE_PRIORITY.join(", ")}`,
    );
  }

  return {
    sources: named.length > 0 ? named : SOURCE_PRIORITY,
    replace: flags.has("--replace"),
    continueOnError: flags.has("--continue-on-error"),
  };
}

async function main() {
  const { sources, replace, continueOnError } = parseArgs(process.argv.slice(2));
  const reports = await runIngestion(sources, { replace, continueOnError });

  console.table(reports);

  const failed = reports.filter((report) => report.status === "failed");
  await (await getMongoClient()).close();

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error("Ingestion failed:", error);
  await (await getMongoClient()).close().catch(() => {});
  process.exit(1);
});
