import { adminJson, adminRoute } from "@/lib/admin/http";
import { maintenanceOverview } from "@/lib/admin/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("maintenance.run", async () =>
  adminJson(await maintenanceOverview()),
);
