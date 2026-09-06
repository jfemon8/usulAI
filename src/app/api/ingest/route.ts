import { NextResponse } from "next/server";
import { SOURCE_PRIORITY } from "@/config/site";
import { getAppEnv } from "@/lib/utils/env";
import { runIngestion } from "@/lib/ingestion/runIngestion";
import { logger } from "@/lib/utils/logger";
import type { SourceType } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface IngestRequestBody {
  sources?: SourceType[];
  replace?: boolean;
}

export async function POST(request: Request) {
  const { INGEST_API_SECRET } = getAppEnv();
  const providedSecret = request.headers.get("x-ingest-secret");

  if (providedSecret !== INGEST_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as IngestRequestBody;
  const requested = body.sources ?? [...SOURCE_PRIORITY];
  const unknown = requested.filter((source) => !SOURCE_PRIORITY.includes(source));

  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown sources: ${unknown.join(", ")}` }, { status: 400 });
  }

  try {
    const reports = await runIngestion(requested, {
      replace: body.replace ?? false,
      continueOnError: true,
    });

    const failed = reports.filter((report) => report.status === "failed");
    return NextResponse.json({ status: failed.length > 0 ? "partial" : "ok", reports });
  } catch (error) {
    logger.error("Ingestion failed", { error: String(error) });
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
