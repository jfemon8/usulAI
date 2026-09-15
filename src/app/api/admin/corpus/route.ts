import { ADMIN_CONFIG } from "@/config/site";
import { recordAudit } from "@/lib/admin/audit";
import {
  corpusEditSchema,
  corpusStats,
  createCorpusDocument,
  isSourceType,
  listCorpus,
} from "@/lib/admin/corpus";
import { AdminError, adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);

  if (url.searchParams.get("stats") === "1") return adminJson(await corpusStats());

  const source = url.searchParams.get("source") || undefined;
  if (source !== undefined && !isSourceType(source)) throw new AdminError("উৎসের ধরন সঠিক নয়।");

  return adminJson(
    await listCorpus({
      ...(source ? { source } : {}),
      query: url.searchParams.get("q") ?? "",
      cursor: url.searchParams.get("cursor") || undefined,
      pageSize: ADMIN_CONFIG.pageSize,
    }),
  );
});

export const POST = adminRoute(async (request, session) => {
  const input = await readJson(request, corpusEditSchema);
  const { view, stored } = await createCorpusDocument(input);

  await recordAudit(
    session.email,
    "corpus.create",
    `${stored.sourceType}:${stored.reference}`,
    `id ${view.id}, ${stored.content.length} characters`,
  );

  return adminJson(view, 201);
});
