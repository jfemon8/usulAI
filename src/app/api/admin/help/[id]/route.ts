import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import {
  answerHelpRequest,
  claimHelpRequest,
  closeHelpRequest,
  deleteHelpRequest,
  getHelpDetail,
  helpActionResponse,
  helpActor,
  reassignHelpRequest,
  releaseHelpRequest,
  reopenHelpRequest,
} from "@/lib/help/requests";
import { helpActionInput } from "@/lib/help/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = adminRoute<Params>("help.view", async (_request, session, params) =>
  adminJson(await getHelpDetail(helpActor(session), params.id)),
);

export const PATCH = adminRoute<Params>("help.handle", async (request, session, params) => {
  const input = await readJson(request, helpActionInput);
  const actor = helpActor(session);
  const target = `help:${params.id}`;

  switch (input.action) {
    case "claim": {
      const doc = await claimHelpRequest(actor, params.id);
      await recordAudit(session.email, "help.claim", target);
      return adminJson(await helpActionResponse(doc, actor));
    }
    case "release": {
      const doc = await releaseHelpRequest(actor, params.id);
      await recordAudit(session.email, "help.release", target);
      return adminJson(await helpActionResponse(doc, actor));
    }
    case "answer": {
      const { doc, warning, edited } = await answerHelpRequest(actor, params.id, input);
      await recordAudit(
        session.email,
        "help.answer",
        target,
        [
          edited ? "edited" : "answered",
          `${doc.sources?.length ?? 0} sources`,
          input.publish ? `published masala ${doc.masalaId ?? "failed"}` : null,
          doc.notification && !edited ? `notified ${doc.notification.sent ? "yes" : "no"}` : null,
        ]
          .filter(Boolean)
          .join("; "),
      );
      return adminJson(await helpActionResponse(doc, actor, warning));
    }
    case "close": {
      const doc = await closeHelpRequest(actor, params.id, input);
      await recordAudit(session.email, "help.close", target, `reason ${input.reason}`);
      return adminJson(await helpActionResponse(doc, actor));
    }
    case "reopen": {
      const doc = await reopenHelpRequest(actor, params.id);
      await recordAudit(session.email, "help.reopen", target);
      return adminJson(await helpActionResponse(doc, actor));
    }
    case "reassign": {
      const { doc, assignee } = await reassignHelpRequest(actor, params.id, input.assigneeId);
      await recordAudit(
        session.email,
        "help.reassign",
        target,
        `to ${assignee.category} ${assignee.name}`,
      );
      return adminJson(await helpActionResponse(doc, actor));
    }
  }
});

export const DELETE = adminRoute<Params>("help.handle", async (_request, session, params) => {
  const removed = await deleteHelpRequest(helpActor(session), params.id);
  await recordAudit(session.email, "help.delete", `help:${params.id}`, `status ${removed.status}`);
  return adminJson({ ok: true });
});
