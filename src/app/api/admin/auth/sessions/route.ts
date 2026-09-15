import { z } from "zod";
import { accountSummary } from "@/lib/admin/accounts";
import { recordAudit } from "@/lib/admin/audit";
import { adminFailure, adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { destroySession, destroySessions, listSessions } from "@/lib/admin/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(async (_request, session) => {
  const [account, sessions] = await Promise.all([
    accountSummary(session.email),
    listSessions(session),
  ]);
  return adminJson({ account, sessions });
});

const deleteSchema = z.union([
  z.object({ id: z.string().min(10).max(100) }),
  z.object({ others: z.literal(true) }),
]);

export const DELETE = adminRoute(async (request, session) => {
  const body = await readJson(request, deleteSchema);

  if ("others" in body) {
    const count = await destroySessions(session.email, session.id);
    await recordAudit(session.email, "auth.sessions-revoked", undefined, `${count} sessions`);
    return adminJson({ ok: true, count });
  }

  if (body.id === session.id) {
    return adminFailure("বর্তমান সেশন বন্ধ করতে লগআউট ব্যবহার করুন।");
  }
  const removed = await destroySession(session.email, body.id);
  if (removed) await recordAudit(session.email, "auth.session-revoked");
  return removed ? adminJson({ ok: true }) : adminFailure("সেশনটি পাওয়া যায়নি।", 404);
});
