import { z } from "zod";
import { ADMIN_CONFIG } from "@/config/site";
import { recordAudit } from "@/lib/admin/audit";
import {
  DATABASE_BROWSER_LIMITS,
  assertCollectionName,
  bulkDelete,
  insertDocument,
  listDocuments,
  parseOffset,
  parsePage,
  readRowSummary,
} from "@/lib/admin/database";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { collection: string };

export const GET = adminRoute<Params>(async (request, _session, params) => {
  const name = assertCollectionName(params.collection);
  const url = new URL(request.url);
  if (url.searchParams.has("row")) {
    return adminJson({ row: await readRowSummary(name, url.searchParams.get("row")) });
  }
  return adminJson(
    await listDocuments(name, {
      filterText: url.searchParams.get("filter"),
      sortField: url.searchParams.get("sort"),
      direction: url.searchParams.get("dir"),
      page: parsePage(url.searchParams.get("page")),
      offset: url.searchParams.has("offset") ? parseOffset(url.searchParams.get("offset")) : null,
    }),
  );
});

const insertSchema = z.object({
  document: z.string().min(2).max(ADMIN_CONFIG.maxJsonDocumentBytes),
});

export const POST = adminRoute<Params>(async (request, session, params) => {
  const name = assertCollectionName(params.collection);
  const body = await readJson(request, insertSchema);
  const result = await insertDocument(name, body.document);
  await recordAudit(
    session.email,
    "database.insert",
    `${name}/${result.id}`,
    `${result.bytes} bytes`,
  );
  return adminJson({ ok: true, id: result.id }, 201);
});

const bulkSchema = z.object({
  filter: z.string().max(DATABASE_BROWSER_LIMITS.maxFilterChars),
  confirmName: z.string().max(200),
  confirmAll: z.boolean().optional(),
});

export const DELETE = adminRoute<Params>(async (request, session, params) => {
  const name = assertCollectionName(params.collection);
  const body = await readJson(request, bulkSchema);
  const result = await bulkDelete(name, {
    filterText: body.filter,
    confirmName: body.confirmName,
    confirmAll: body.confirmAll === true,
  });
  await recordAudit(
    session.email,
    "database.bulk-delete",
    `${name}/*`,
    `deleted=${result.deletedCount} filter=${body.filter.trim() || "{}"}`,
  );
  return adminJson({ ok: true, deletedCount: result.deletedCount });
});
