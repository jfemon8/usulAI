import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { runMaintenanceNow } from "@/lib/admin/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ dryRun: z.boolean() });

export const POST = adminRoute("maintenance.run", async (request, session) => {
  const { dryRun } = await readJson(request, schema);
  const report = await runMaintenanceNow(dryRun);
  await recordAudit(
    session.email,
    dryRun ? "maintenance.dry-run" : "maintenance.run",
    "retention",
    [
      `used ${report.usedBefore} -> ${report.usedAfter} bytes`,
      `insights ${report.insightsRolledUp}`,
      `query embeddings ${report.queryEmbeddingsCapped}`,
      `feedback ${report.feedbackDrained}`,
      `tallies ${report.talliesPruned}`,
      `signals ${report.signalsPruned}`,
      `evicted ${report.embeddingsEvicted}`,
      `pretranslated ${report.passagesPretranslated}`,
    ].join(", "),
  );
  return adminJson(report);
});
