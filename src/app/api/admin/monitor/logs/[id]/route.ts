import { adminJson, adminRoute } from "@/lib/admin/http";
import { getMonitorLog } from "@/lib/admin/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = adminRoute<Params>("monitor.view", async (_request, _session, params) =>
  adminJson(await getMonitorLog(params.id)),
);
