import "./loadEnv";
import { DB_CONFIG } from "@/config/site";
import { feedbackSummary } from "@/lib/analytics/feedback";
import { listVerifiedAnswers } from "@/lib/analytics/verifiedAnswers";
import { getDb, getMongoClient } from "@/lib/db/mongoClient";
import { embeddingCoverage } from "@/lib/retrieval/vectorStore";
import type { QueryLogEntry } from "@/lib/analytics/queryLog";

const WEAK_SCORE = 4.2;

function heading(title: string) {
  console.log(`\n${title}\n${"-".repeat(title.length)}`);
}

async function main() {
  const db = await getDb();
  const logs = db.collection<QueryLogEntry>(DB_CONFIG.queryLogCollection);

  const total = await logs.countDocuments();
  const coverage = await embeddingCoverage();
  const feedback = await feedbackSummary();
  const verified = await listVerifiedAnswers(1000);

  heading("Corpus");
  console.log(`  documents        ${coverage.total}`);
  console.log(
    `  embedded         ${coverage.embedded} (${((coverage.embedded / Math.max(coverage.total, 1)) * 100).toFixed(1)}%)`,
  );

  heading("Questions asked");
  console.log(`  logged           ${total}`);

  if (total === 0) {
    console.log("\n  No query history yet — ask some questions first.");
    await (await getMongoClient()).close();
    return;
  }

  const unanswered = await logs
    .find({ $or: [{ retrievedCount: 0 }, { answered: false }] })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();

  const weak = await logs
    .find({ retrievedCount: { $gt: 0 }, topScore: { $lt: WEAK_SCORE } })
    .sort({ topScore: 1 })
    .limit(30)
    .toArray();

  heading(`Nothing retrieved or no answer (${unanswered.length})`);
  if (unanswered.length === 0) console.log("  none");
  for (const entry of unanswered) {
    console.log(`  · ${entry.question.slice(0, 90)}`);
  }

  heading(`Weak evidence, top score below ${WEAK_SCORE} (${weak.length})`);
  if (weak.length === 0) console.log("  none");
  for (const entry of weak) {
    console.log(`  · ${entry.topScore?.toFixed(2)}  ${entry.question.slice(0, 80)}`);
  }

  const bySource = await logs
    .aggregate<{ _id: string; count: number }>([
      { $unwind: "$sourcesUsed" },
      { $group: { _id: "$sourcesUsed", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  heading("Which sources actually answer");
  for (const row of bySource) console.log(`  ${row._id.padEnd(8)} ${row.count}`);

  const retrievalMode = await logs
    .aggregate<{ _id: null; vector: number; text: number }>([
      { $group: { _id: null, vector: { $sum: "$vectorHits" }, text: { $sum: "$textHits" } } },
    ])
    .toArray();

  const mode = retrievalMode[0];
  if (mode) {
    console.log(`\n  vector hits      ${mode.vector}`);
    console.log(`  text hits        ${mode.text}`);
  }

  heading("Feedback");
  console.log(`  helpful          ${feedback.helpful}`);
  console.log(`  unhelpful        ${feedback.unhelpful}`);
  console.log(`  wrong citation   ${feedback.wrongCitation}`);
  console.log(`  awaiting review  ${feedback.pending}`);
  console.log(`  verified answers ${verified.length}`);

  if (verified.length > 0) {
    heading("Verified answers served");
    for (const answer of verified.slice(0, 15)) {
      console.log(`  ${String(answer.servedCount).padStart(4)}×  ${answer.question.slice(0, 70)}`);
    }
  }

  await (await getMongoClient()).close();
}

main().catch(async (error) => {
  console.error("Gap report failed:", error);
  await (await getMongoClient()).close().catch(() => {});
  process.exit(1);
});
