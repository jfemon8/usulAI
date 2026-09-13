import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance/retention";
import { maintenanceAccess } from "@/lib/security/maintenanceAccess";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const access = maintenanceAccess(request);

  if (access === "denied") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (access === "vercel-cron") {
    const limit = await consumeRateLimit("maintenance", request);
    if (!limit.allowed) return rateLimitResponse(limit);
  }

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    return NextResponse.json(await runMaintenance({ dryRun }));
  } catch (error) {
    logger.error("Maintenance failed", { error: String(error) });
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}
