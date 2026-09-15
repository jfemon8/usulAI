import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { revalidateMasail } from "@/lib/reviews/revalidate";
import {
  createMasala,
  listWorkspace,
  masalaInput,
  type WorkspaceTab,
} from "@/lib/reviews/scholarAnswers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS: readonly WorkspaceTab[] = ["mine", "all", "published"];

export const GET = adminRoute("masail.write", async (request, session) => {
  const url = new URL(request.url);
  const tab = TABS.find((entry) => entry === url.searchParams.get("tab")) ?? "mine";
  return adminJson(
    await listWorkspace(
      {
        tab,
        search: url.searchParams.get("q") ?? undefined,
        authorId: url.searchParams.get("author")?.slice(0, 200) || undefined,
        cursor: url.searchParams.get("cursor") || undefined,
      },
      session,
    ),
  );
});

export const POST = adminRoute("masail.write", async (request, session) => {
  const input = await readJson(request, masalaInput);
  const created = await createMasala(input, session);
  await recordAudit(
    session.email,
    "masail.create",
    created.question.slice(0, 200),
    `${created.sources.length} sources${created.published ? ", published" : ""}`,
  );
  if (created.published) revalidateMasail(created.id);
  return adminJson(created, 201);
});
