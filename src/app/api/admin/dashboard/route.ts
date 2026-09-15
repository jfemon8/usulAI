import { dashboardSnapshot } from "@/lib/admin/dashboard";
import { adminJson, adminRoute } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("dashboard.view", async (_request, session) =>
  adminJson(await dashboardSnapshot(session.role)),
);
