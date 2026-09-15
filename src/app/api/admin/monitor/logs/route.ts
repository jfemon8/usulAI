import { adminJson, adminRoute } from "@/lib/admin/http";
import { listMonitorLogs, parseMonitorFilters } from "@/lib/admin/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("monitor.view", async (request) =>
  adminJson(await listMonitorLogs(parseMonitorFilters(new URL(request.url).searchParams))),
);
