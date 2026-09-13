import "./loadEnv";
import { DB_CONFIG, RETRIEVAL_CONFIG } from "@/config/site";
import { embedText } from "@/lib/ai/embeddings";
import { getDocumentsCollection, getMongoClient } from "@/lib/db/mongoClient";
import { recommendThreshold } from "@/lib/retrieval/calibration";
import { toFloat32Vector } from "@/lib/retrieval/vectorStore";
import { NOISE_QUESTIONS, RELEVANT_CASES } from "../tests/fixtures/similarityCalibration";

interface ScoredRow {
  citation: { reference: string };
  score: number;
}

async function scores(question: string): Promise<ScoredRow[]> {
  const collection = await getDocumentsCollection();
  const vector = await embedText(question);

  return collection
    .aggregate<ScoredRow>([
      {
        $vectorSearch: {
          index: DB_CONFIG.vectorIndex,
          path: DB_CONFIG.embeddingPath,
          queryVector: toFloat32Vector(vector),
          numCandidates: 400,
          limit: 20,
          filter: { sourceType: { $eq: "quran" } },
        },
      },
      { $project: { citation: 1, score: { $meta: "vectorSearchScore" } } },
    ])
    .toArray();
}

function median(values: number[]): number | undefined {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function main() {
  const collection = await getDocumentsCollection();
  const labelled = RELEVANT_CASES.flatMap((testCase) => testCase.references);
  const embedded = new Set(
    (
      await collection
        .find(
          { "citation.reference": { $in: labelled }, embeddingModel: { $exists: true } },
          { projection: { "citation.reference": 1 } },
        )
        .toArray()
    ).map((row) => row.citation.reference),
  );

  try {
    await embedText(RELEVANT_CASES[0]?.question ?? "test");
  } catch (error) {
    console.log(`Query embedding unavailable, cannot calibrate: ${String(error).slice(0, 140)}`);
    await (await getMongoClient()).close();
    process.exitCode = 1;
    return;
  }

  const relevant: number[] = [];
  const hardNegatives: number[] = [];

  for (const testCase of RELEVANT_CASES) {
    const missing = testCase.references.filter((reference) => !embedded.has(reference));
    if (missing.length > 0) {
      console.log(`SKIP  ${testCase.question}: not embedded ${missing.join(", ")}`);
      continue;
    }

    const rows = await scores(testCase.question);
    const hits = rows.filter((row) => testCase.references.includes(row.citation.reference));
    const bestOther = rows.find((row) => !testCase.references.includes(row.citation.reference));

    for (const hit of hits) relevant.push(hit.score);
    if (bestOther) hardNegatives.push(bestOther.score);

    const found = hits
      .map(
        (hit) => `${hit.citation.reference}=${hit.score.toFixed(3)} rank ${rows.indexOf(hit) + 1}`,
      )
      .join(", ");
    console.log(
      `REL   ${testCase.question}: ${found || "not in top 20"} | best other ${bestOther?.citation.reference}=${bestOther?.score.toFixed(3)}`,
    );
  }

  const noiseTop: number[] = [];
  for (const question of NOISE_QUESTIONS) {
    const [top] = await scores(question);
    if (top) noiseTop.push(top.score);
    console.log(`NOISE ${question}: top ${top?.citation.reference}=${top?.score.toFixed(3)}`);
  }

  const recommendation = recommendThreshold(relevant, noiseTop);
  const verdict = recommendation.separated
    ? "clean separation, midpoint"
    : "overlap, 10th percentile of relevant scores; the re-ranker filters the rest";

  console.log(`\ncurrent minVectorScore ${RETRIEVAL_CONFIG.minVectorScore}`);
  console.log(
    `relevant floor ${recommendation.relevantFloor.toFixed(3)} | noise ceiling ${recommendation.noiseCeiling.toFixed(3)} | margin ${recommendation.margin}`,
  );
  console.log(`recommended ${recommendation.threshold} (${verdict})`);
  console.log(
    `median best non-labelled hit per relevant question ${median(hardNegatives)?.toFixed(3)}`,
  );

  await (await getMongoClient()).close();
}

void main();
