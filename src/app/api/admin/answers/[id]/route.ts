import { recordAudit } from "@/lib/admin/audit";
import { answerInput, getAnswer, removeAnswer, updateAnswer } from "@/lib/admin/answers";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = adminRoute<Params>(async (_request, _session, params) =>
  adminJson(await getAnswer(params.id)),
);

export const PUT = adminRoute<Params>(async (request, session, params) => {
  const input = await readJson(request, answerInput);
  const previous = await getAnswer(params.id);
  const updated = await updateAnswer(params.id, input, session.email);
  const changes = [
    previous.question !== updated.question ? `question was "${previous.question}"` : null,
    previous.answer !== updated.answer ? "answer changed" : null,
    previous.origin !== updated.origin ? `origin ${previous.origin} -> ${updated.origin}` : null,
    `${updated.sources.length} sources`,
  ].filter(Boolean);
  await recordAudit(session.email, "answers.update", updated.question, changes.join("; "));
  return adminJson(updated);
});

export const DELETE = adminRoute<Params>(async (_request, session, params) => {
  const question = await removeAnswer(params.id);
  await recordAudit(session.email, "answers.delete", question);
  return adminJson({ ok: true });
});
