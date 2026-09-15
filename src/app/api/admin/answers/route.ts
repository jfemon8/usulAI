import { recordAudit } from "@/lib/admin/audit";
import { answerInput, createAnswer, listAnswers } from "@/lib/admin/answers";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const origin = url.searchParams.get("origin");
  return adminJson(
    await listAnswers({
      search: url.searchParams.get("q") ?? undefined,
      origin: origin === "auto" || origin === "scholar" ? origin : undefined,
      cursor: url.searchParams.get("cursor") || undefined,
    }),
  );
});

export const POST = adminRoute(async (request, session) => {
  const input = await readJson(request, answerInput);
  const created = await createAnswer(input, session.email);
  await recordAudit(
    session.email,
    "answers.create",
    created.question,
    `${created.origin}, ${created.sources.length} sources`,
  );
  return adminJson(created, 201);
});
