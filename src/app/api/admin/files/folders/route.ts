import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import {
  createFolder,
  deleteFolder,
  FILE_LIMITS,
  listSubfolders,
  normalizeFolderPath,
} from "@/lib/admin/cloudinaryAdmin";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute("files.manage", async (request) => {
  const path = normalizeFolderPath(new URL(request.url).searchParams.get("path"));
  return adminJson({ path, folders: await listSubfolders(path) });
});

const folderSchema = z.object({
  path: z.string().trim().min(1).max(FILE_LIMITS.maxPublicIdChars),
});

export const POST = adminRoute("files.manage", async (request, session) => {
  const { path } = await readJson(request, folderSchema);
  const folder = await createFolder(path);
  await recordAudit(session.email, "files.folder-create", folder);
  return adminJson({ ok: true, path: folder }, 201);
});

export const DELETE = adminRoute("files.manage", async (request, session) => {
  const { path } = await readJson(request, folderSchema);
  const folder = await deleteFolder(path);
  await recordAudit(session.email, "files.folder-delete", folder);
  return adminJson({ ok: true, path: folder });
});
