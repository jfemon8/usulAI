import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import {
  assetRefSchema,
  deliveryTypeSchema,
  FILE_LIMITS,
  getAsset,
  renameAsset,
  setAssetTags,
} from "@/lib/admin/cloudinaryAdmin";
import { AdminError, adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("files.manage", async (request) => {
  const url = new URL(request.url);
  const parsed = assetRefSchema.safeParse({
    publicId: url.searchParams.get("publicId") ?? "",
    resourceType: url.searchParams.get("resourceType") ?? "",
    type: url.searchParams.get("type") ?? "",
  });
  if (!parsed.success) throw new AdminError("ফাইলের public ID, ধরন ও ডেলিভারি ধরন দিন।");
  return adminJson({ asset: await getAsset(parsed.data) });
});

const patchSchema = assetRefSchema.extend({
  toPublicId: z.string().trim().min(1).max(FILE_LIMITS.maxPublicIdChars).optional(),
  toType: deliveryTypeSchema.optional(),
  overwrite: z.boolean().default(false),
  tags: z.array(z.string().max(FILE_LIMITS.maxTagChars)).max(FILE_LIMITS.maxTags).optional(),
});

function label(resourceType: string, type: string, publicId: string): string {
  return `${resourceType}/${type}/${publicId}`;
}

export const PATCH = adminRoute("files.manage", async (request, session) => {
  const body = await readJson(request, patchSchema);
  const renaming = body.toPublicId !== undefined || body.toType !== undefined;

  if (renaming && body.tags !== undefined) {
    throw new AdminError("নাম বদল ও ট্যাগ পরিবর্তন আলাদাভাবে করুন।");
  }

  if (renaming) {
    const asset = await renameAsset({
      publicId: body.publicId,
      resourceType: body.resourceType,
      type: body.type,
      toPublicId: body.toPublicId ?? body.publicId,
      toType: body.toType ?? body.type,
      overwrite: body.overwrite,
    });
    await recordAudit(
      session.email,
      "files.rename",
      label(body.resourceType, body.type, body.publicId),
      `to ${label(asset.resourceType, asset.type, asset.publicId)}${body.overwrite ? " (overwrite)" : ""}`,
    );
    return adminJson({ asset });
  }

  if (body.tags !== undefined) {
    const asset = await setAssetTags({
      publicId: body.publicId,
      resourceType: body.resourceType,
      type: body.type,
      tags: body.tags,
    });
    await recordAudit(
      session.email,
      "files.tags",
      label(body.resourceType, body.type, body.publicId),
      asset.tags.join(", ") || "no tags",
    );
    return adminJson({ asset });
  }

  throw new AdminError("কী পরিবর্তন করতে চান তা জানানো হয়নি।");
});
