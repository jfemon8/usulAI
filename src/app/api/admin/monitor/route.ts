import { adminJson, adminRoute } from "@/lib/admin/http";
import { monitorSummary } from "@/lib/admin/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("monitor.view", async () => adminJson(await monitorSummary()));
