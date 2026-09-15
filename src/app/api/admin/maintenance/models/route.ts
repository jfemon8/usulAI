import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute } from "@/lib/admin/http";
import { clearModelCooldowns } from "@/lib/admin/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = adminRoute("maintenance.run", async (_request, session) => {
  const cleared = clearModelCooldowns();
  await recordAudit(
    session.email,
    "maintenance.clear",
    "model-cooldowns",
    `${cleared} cooling models on this instance`,
  );
  return adminJson({ cleared });
});
