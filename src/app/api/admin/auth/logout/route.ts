import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute } from "@/lib/admin/http";
import { destroyCurrentSession } from "@/lib/admin/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute(async (_request, session) => {
  await destroyCurrentSession();
  await recordAudit(session.email, "auth.logout");
  return adminJson({ ok: true });
});
