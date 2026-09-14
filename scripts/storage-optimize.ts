import "./loadEnv";
import { getMongoClient } from "@/lib/db/mongoClient";
import { optimizeStorage } from "@/lib/maintenance/optimize";
import { describeUsage } from "@/lib/maintenance/storage";

async function main() {
  const report = await optimizeStorage();
  const saved = (report.before.usedBytes - report.after.usedBytes) / 1024 / 1024;

  console.log(
    JSON.stringify(
      {
        before: describeUsage(report.before),
        after: describeUsage(report.after),
        savedMb: Number(saved.toFixed(2)),
        provenanceRecorded: report.provenanceRecorded,
        surahNotesMoved: report.notesMoved,
        arrayEmbeddingsConverted: report.arraysConverted,
        documentsTrimmed: report.fieldsCleared,
        derivedFieldsRemoved: report.derivedFieldsRemoved,
        contentHashesPacked: report.hashesPacked,
        indexesDropped: report.indexesDropped,
      },
      null,
      2,
    ),
  );

  await (await getMongoClient()).close();
}

void main();
