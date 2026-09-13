import "./loadEnv";
import { SOURCE_PRIORITY } from "@/config/site";
import { getMongoClient } from "@/lib/db/mongoClient";
import { retrieveForQuestion } from "@/lib/retrieval/search";
import { embeddingCoverage } from "@/lib/retrieval/vectorStore";
import { GOLDEN_SET, type GoldenCase } from "../tests/fixtures/goldenSet";
import type { RetrievedChunk } from "@/types";

interface CaseResult {
  question: string;
  passed: boolean;
  retrieved: number;
  sources: string;
  orderOk: boolean;
  missingSources: string[];
  forbiddenSources: string[];
  scopedTo: string;
  missingReferences: string[];
  forbiddenReferences: string[];
  references: string[];
}

function priorityOrderHolds(context: RetrievedChunk[]): boolean {
  const positions = context.map((chunk) => SOURCE_PRIORITY.indexOf(chunk.sourceType));
  return positions.every(
    (value, index) => index === 0 || value >= (positions[index - 1] as number),
  );
}

async function evaluateCase(testCase: GoldenCase): Promise<CaseResult> {
  const { context, scopedTo } = await retrieveForQuestion(testCase.question, testCase.question, {
    lazyEmbed: false,
  });
  const found = new Set(context.map((chunk) => chunk.sourceType));
  const references = context.map((chunk) => chunk.citation.reference);

  const missingSources = testCase.expectSources.filter((source) => !found.has(source));
  const forbiddenSources = (testCase.forbidSources ?? []).filter((source) => found.has(source));
  const missingReferences = (testCase.expectReferences ?? []).filter(
    (reference) => !references.some((actual) => actual.includes(reference)),
  );
  const forbiddenReferences = (testCase.forbidReferences ?? []).filter((reference) =>
    references.some((actual) => actual.includes(reference)),
  );
  const orderOk = priorityOrderHolds(context);

  return {
    question: testCase.question,
    passed:
      context.length > 0 &&
      missingSources.length === 0 &&
      forbiddenSources.length === 0 &&
      missingReferences.length === 0 &&
      forbiddenReferences.length === 0 &&
      orderOk,
    retrieved: context.length,
    sources: [...found].join(","),
    orderOk,
    missingSources,
    forbiddenSources,
    scopedTo: scopedTo?.join(",") ?? "all",
    missingReferences,
    forbiddenReferences,
    references,
  };
}

async function main() {
  const coverage = await embeddingCoverage();
  console.log(
    `corpus: ${coverage.total} documents, ${coverage.embedded} embedded (${((coverage.embedded / coverage.total) * 100).toFixed(1)}%)\n`,
  );

  const results: CaseResult[] = [];
  for (const testCase of GOLDEN_SET) {
    results.push(await evaluateCase(testCase));
  }

  for (const result of results) {
    const mark = result.passed ? "PASS" : "FAIL";
    console.log(`${mark}  ${result.question}`);
    console.log(
      `      retrieved ${result.retrieved} [${result.sources}] order=${result.orderOk} scope=${result.scopedTo}`,
    );
    if (result.forbiddenSources.length > 0) {
      console.log(
        `      sources outside the question's scope: ${result.forbiddenSources.join(", ")}`,
      );
    }
    if (result.missingSources.length > 0) {
      console.log(`      missing sources: ${result.missingSources.join(", ")}`);
    }
    console.log(`      refs: ${result.references.join(" | ")}`);
    if (result.forbiddenReferences.length > 0) {
      console.log(`      off-topic refs: ${result.forbiddenReferences.join(", ")}`);
    }
    if (result.missingReferences.length > 0) {
      console.log(`      missing refs: ${result.missingReferences.join(", ")}`);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const empty = results.filter((result) => result.retrieved === 0).length;

  console.log(`\n${passed}/${results.length} passed | ${empty} returned nothing`);

  await (await getMongoClient()).close();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(async (error) => {
  console.error("Evaluation failed:", error);
  await (await getMongoClient()).close().catch(() => {});
  process.exit(1);
});
