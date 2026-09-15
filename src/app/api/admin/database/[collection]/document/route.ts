import { z } from "zod";
import { ADMIN_CONFIG } from "@/config/site";
import { recordAudit } from "@/lib/admin/audit";
import {
  assertCollectionName,
  deleteDocument,
  readDocument,
  replaceDocument,
} from "@/lib/admin/database";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { collection: string };

function idParam(request: Request): string | null {
  return new URL(request.url).searchParams.get("id");
}

export const GET = adminRoute<Params>(async (request, _session, params) => {
  const name = assertCollectionName(params.collection);
  return adminJson(await readDocument(name, idParam(request)));
});

const replaceSchema = z.object({
  document: z.string().min(2).max(ADMIN_CONFIG.maxJsonDocumentBytes),
  revision: z.string().min(1).max(100),
});

export const PUT = adminRoute<Params>(async (request, session, params) => {
  const name = assertCollectionName(params.collection);
  const body = await readJson(request, replaceSchema);
  const result = await replaceDocument(name, idParam(request), body.document, body.revision);
  await recordAudit(
    session.email,
    "database.replace",
    `${name}/${result.view?.id ?? idParam(request) ?? ""}`,
    result.changed.length > 0 ? `changed: ${result.changed.join(", ")}` : "no field changed",
  );
  return adminJson({ ok: true, document: result.view, changed: result.changed });
});

export const DELETE = adminRoute<Params>(async (request, session, params) => {
  const name = assertCollectionName(params.collection);
  const result = await deleteDocument(name, idParam(request));
  await recordAudit(
    session.email,
    "database.delete",
    `${name}/${result.id}`,
    `${result.bytes} bytes`,
  );
  return adminJson({ ok: true });
});
