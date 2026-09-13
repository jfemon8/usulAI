import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance/retention";
import { getAppEnv } from "@/lib/utils/env";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorised(request: Request): boolean {
  const { INGEST_API_SECRET, CRON_SECRET } = getAppEnv();
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = request.headers.get("x-ingest-secret");

  return Boolean(
    (CRON_SECRET && bearer === CRON_SECRET) || (header && header === INGEST_API_SECRET),
  );
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    return NextResponse.json(await runMaintenance({ dryRun }));
  } catch (error) {
    logger.error("Maintenance failed", { error: String(error) });
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}
