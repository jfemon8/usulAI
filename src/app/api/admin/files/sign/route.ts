import { z } from "zod";
import {
  deliveryTypeSchema,
  FILE_LIMITS,
  resourceTypeSchema,
  signUpload,
} from "@/lib/admin/cloudinaryAdmin";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const signSchema = z.object({
  folder: z.string().max(FILE_LIMITS.maxPublicIdChars).default(""),
  fileName: z.string().trim().min(1).max(FILE_LIMITS.maxPublicIdChars),
  publicId: z.string().max(FILE_LIMITS.maxPublicIdChars).nullish(),
  resourceType: resourceTypeSchema,
  type: deliveryTypeSchema.default("upload"),
  overwrite: z.boolean().default(false),
});

export const POST = adminRoute("files.manage", async (request) => {
  const body = await readJson(request, signSchema);
  return adminJson(await signUpload(body));
});
