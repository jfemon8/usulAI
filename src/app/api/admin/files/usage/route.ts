import { getUsage } from "@/lib/admin/cloudinaryAdmin";
import { adminJson, adminRoute } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => adminJson({ usage: await getUsage() }));
