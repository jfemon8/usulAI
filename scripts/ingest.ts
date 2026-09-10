import "./loadEnv";
import { SOURCE_PRIORITY } from "@/config/site";
import { getMongoClient } from "@/lib/db/mongoClient";
import { runIngestion } from "@/lib/ingestion/runIngestion";
import type { SourceType } from "@/types";

function numericFlag(argv: string[], name: string): number | undefined {
  const match = argv.find((arg) => arg.startsWith(`${name}=`));
  if (!match) return undefined;

  const value = Number(match.split("=")[1]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

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
    resume: flags.has("--resume"),
    textOnly: flags.has("--text-only"),
    limit: numericFlag(argv, "--limit"),
    skip: numericFlag(argv, "--skip"),
  };
}

async function main() {
  const { sources, replace, continueOnError, resume, textOnly, limit, skip } = parseArgs(
    process.argv.slice(2),
  );
  const reports = await runIngestion(sources, {
    replace,
    continueOnError,
    resume,
    textOnly,
    limit,
    skip,
  });

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
