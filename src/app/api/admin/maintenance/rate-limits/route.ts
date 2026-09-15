import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import {
  listRateLimits,
  maskClient,
  unblockRateLimit,
  unblockSchema,
} from "@/lib/admin/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("maintenance.run", async () => adminJson(await listRateLimits()));

export const DELETE = adminRoute("maintenance.run", async (request, session) => {
  const { id } = await readJson(request, unblockSchema);
  await unblockRateLimit(id);
  const [scope = "", client = ""] = id.split(":");
  await recordAudit(session.email, "maintenance.unblock", `${scope}:${maskClient(client)}`);
  return adminJson({ ok: true });
});
