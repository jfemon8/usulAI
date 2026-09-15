import { recordAudit } from "@/lib/admin/audit";
import {
  corpusEditSchema,
  deleteCorpusDocument,
  getCorpusDocument,
  updateCorpusDocument,
} from "@/lib/admin/corpus";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = adminRoute<Params>("corpus.manage", async (_request, _session, params) =>
  adminJson(await getCorpusDocument(params.id)),
);

export const PUT = adminRoute<Params>("corpus.manage", async (request, session, params) => {
  const input = await readJson(request, corpusEditSchema);
  const { view, stored, previous, contentChanged } = await updateCorpusDocument(params.id, input);

  const changes = [
    previous.sourceType !== stored.sourceType
      ? `source ${previous.sourceType} -> ${stored.sourceType}`
      : null,
    previous.reference !== stored.reference ? `reference was "${previous.reference}"` : null,
    contentChanged ? "content changed, embedding cleared" : "citation or metadata only",
  ].filter(Boolean);

  await recordAudit(
    session.email,
    "corpus.update",
    `${stored.sourceType}:${stored.reference}`,
    `id ${view.id}; ${changes.join("; ")}`,
  );

  return adminJson(view);
});

export const DELETE = adminRoute<Params>("corpus.manage", async (_request, session, params) => {
  const removed = await deleteCorpusDocument(params.id);

  await recordAudit(
    session.email,
    "corpus.delete",
    `${removed.sourceType}:${removed.reference}`,
    `id ${params.id}`,
  );

  return adminJson({ ok: true });
});
