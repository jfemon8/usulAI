import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import { assetRefSchema, assetUrl } from "@/lib/admin/cloudinaryAdmin";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const urlSchema = assetRefSchema.extend({
  format: z.string().max(10).nullish(),
  download: z.boolean().default(false),
});

export const POST = adminRoute(async (request, session) => {
  const body = await readJson(request, urlSchema);
  const result = assetUrl(body);
  if (body.type !== "upload") {
    await recordAudit(
      session.email,
      body.download ? "files.download" : "files.open",
      `${body.resourceType}/${body.type}/${body.publicId}`,
    );
  }
  return adminJson(result);
});
