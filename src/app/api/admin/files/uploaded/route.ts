import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import { assetRefSchema, FILE_LIMITS, forgetScans } from "@/lib/admin/cloudinaryAdmin";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadedSchema = z.object({
  items: z
    .array(
      assetRefSchema.extend({
        bytes: z.number().int().min(0).max(10_000_000_000),
        existing: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(FILE_LIMITS.maxBulkItems),
});

export const POST = adminRoute("files.manage", async (request, session) => {
  const { items } = await readJson(request, uploadedSchema);
  forgetScans();

  const stored = items.filter((item) => !item.existing);
  const kept = items.filter((item) => item.existing);
  const first = stored[0];

  await recordAudit(
    session.email,
    "files.upload",
    stored.length === 1 && first
      ? `${first.resourceType}/${first.type}/${first.publicId}`
      : `${stored.length} files`,
    [
      ...stored.map(
        (item) => `${item.resourceType}/${item.type}/${item.publicId} (${item.bytes} B)`,
      ),
      ...kept.map((item) => `kept existing: ${item.publicId}`),
    ].join(", "),
  );
  return adminJson({ ok: true });
});
