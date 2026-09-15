import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import {
  assetRefSchema,
  deleteAssets,
  deliveryTypeSchema,
  FILE_LIMITS,
  listFolder,
  resourceTypeSchema,
  searchAssets,
} from "@/lib/admin/cloudinaryAdmin";
import { AdminError, adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const browseSchema = z.object({
  resourceType: resourceTypeSchema.default("raw"),
  type: deliveryTypeSchema.default("upload"),
  path: z.string().max(FILE_LIMITS.maxPublicIdChars).default(""),
  cursor: z.string().max(FILE_LIMITS.maxCursorChars).optional(),
  fresh: z.string().max(20).optional(),
});

const searchSchema = z.object({
  q: z.string().trim().min(1).max(FILE_LIMITS.maxSearchChars),
  resourceType: resourceTypeSchema.or(z.literal("all")).default("all"),
  type: deliveryTypeSchema.or(z.literal("all")).default("all"),
  folder: z.string().max(FILE_LIMITS.maxPublicIdChars).optional(),
  cursor: z.string().max(FILE_LIMITS.maxCursorChars).optional(),
});

function queryOf<T extends z.ZodTypeAny>(url: URL, schema: T): z.infer<T> {
  const values: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (key !== "view") values[key] = value;
  }
  const parsed = schema.safeParse(values);
  if (!parsed.success) throw new AdminError("খোঁজার শর্তগুলো সঠিক নয়।");
  return parsed.data;
}

export const GET = adminRoute("files.manage", async (request) => {
  const url = new URL(request.url);

  if (url.searchParams.get("view") === "search") {
    const query = queryOf(url, searchSchema);
    return adminJson(
      await searchAssets({
        term: query.q,
        resourceType: query.resourceType === "all" ? null : query.resourceType,
        type: query.type === "all" ? null : query.type,
        folder: query.folder ?? null,
        cursor: query.cursor ?? null,
      }),
    );
  }

  const query = queryOf(url, browseSchema);
  return adminJson(
    await listFolder({
      resourceType: query.resourceType,
      type: query.type,
      path: query.path,
      cursor: query.cursor ?? null,
      fresh: Boolean(query.fresh),
    }),
  );
});

const deleteSchema = z.object({
  items: z.array(assetRefSchema).min(1).max(FILE_LIMITS.maxBulkItems),
});

export const DELETE = adminRoute("files.manage", async (request, session) => {
  const { items } = await readJson(request, deleteSchema);
  const result = await deleteAssets(items);

  await recordAudit(
    session.email,
    "files.delete",
    result.deleted.length === 1 ? result.deleted[0] : `${result.deleted.length} files`,
    [...result.deleted, ...result.notFound.map((id) => `not found: ${id}`)].join(", "),
  );
  return adminJson({ ok: true, ...result });
});
