import { NextResponse } from "next/server";
import { z } from "zod";
import { INGESTION_JOB_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { getAppEnv } from "@/lib/utils/env";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  sources: z.array(z.enum(SOURCE_PRIORITY)).optional(),
  mode: z.enum(INGESTION_JOB_CONFIG.modes).default("embed-only"),
  limit: z.number().int().min(1).max(100_000).optional(),
  replace: z.boolean().default(false),
});

export async function POST(request: Request) {
  const { INGEST_API_SECRET, GITHUB_DISPATCH_TOKEN, GITHUB_REPOSITORY } = getAppEnv();

  if (request.headers.get("x-ingest-secret") !== INGEST_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  if (!GITHUB_DISPATCH_TOKEN || !GITHUB_REPOSITORY) {
    return NextResponse.json(
      {
        error:
          "Ingestion no longer runs inside a serverless request. Set GITHUB_DISPATCH_TOKEN and GITHUB_REPOSITORY to trigger the ingestion workflow, or run it from the GitHub Actions tab.",
      },
      { status: 503 },
    );
  }

  const { sources, mode, limit, replace } = parsed.data;
  const endpoint = `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${INGESTION_JOB_CONFIG.workflowFile}/dispatches`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ref: INGESTION_JOB_CONFIG.ref,
      inputs: {
        sources: (sources ?? []).join(" "),
        mode,
        limit: String(limit ?? INGESTION_JOB_CONFIG.defaultEmbedLimit),
        replace: String(replace),
      },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    logger.error("Ingestion workflow dispatch failed", { status: response.status, detail });
    return NextResponse.json({ error: "Workflow dispatch failed", detail }, { status: 502 });
  }

  return NextResponse.json(
    {
      status: "queued",
      mode,
      runs: `https://github.com/${GITHUB_REPOSITORY}/actions/workflows/${INGESTION_JOB_CONFIG.workflowFile}`,
    },
    { status: 202 },
  );
}
