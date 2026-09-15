import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute } from "@/lib/admin/http";
import { clearQueryEmbeddings } from "@/lib/admin/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = adminRoute("maintenance.run", async (_request, session) => {
  const removed = await clearQueryEmbeddings();
  await recordAudit(
    session.email,
    "maintenance.clear",
    "query-embeddings",
    `${removed} cached query vectors`,
  );
  return adminJson({ removed });
});
