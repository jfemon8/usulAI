import { ADMIN_CONFIG } from "@/config/site";
import { listAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("audit.view", async (request) => {
  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const beforeDate = before ? new Date(before) : undefined;

  return adminJson(
    await listAudit({
      limit: ADMIN_CONFIG.pageSize,
      ...(beforeDate && !Number.isNaN(beforeDate.getTime()) ? { before: beforeDate } : {}),
      ...(email ? { email } : {}),
    }),
  );
});
