import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { clearLearnedMemory, forgetTopic, forgetTopicSchema } from "@/lib/admin/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute("maintenance.run", async (request, session) => {
  const input = await readJson(request, forgetTopicSchema);
  const result = await forgetTopic(input);
  await recordAudit(
    session.email,
    "maintenance.forget",
    result.topic,
    `${result.removed} stored rewrites and judgements`,
  );
  return adminJson(result);
});

export const DELETE = adminRoute("maintenance.run", async (_request, session) => {
  const removed = await clearLearnedMemory();
  await recordAudit(
    session.email,
    "maintenance.clear",
    "learned-memory",
    `${removed} rewrites and judgements, model stats kept`,
  );
  return adminJson({ removed });
});
