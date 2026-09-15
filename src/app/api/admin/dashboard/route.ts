import { dashboardSnapshot } from "@/lib/admin/dashboard";
import { adminJson, adminRoute } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => adminJson(await dashboardSnapshot()));
