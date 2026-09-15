import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { revalidateMasail } from "@/lib/reviews/revalidate";
import {
  deleteMasala,
  getWorkspaceMasala,
  masalaInput,
  setMasalaPublished,
  updateMasala,
} from "@/lib/reviews/scholarAnswers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

const publishInput = z.object({ published: z.boolean() });

function ownerNote(
  author: { id: string; name: string } | null,
  session: { principalId: string; email: string },
): string {
  return author && author.id !== session.principalId
    ? `author ${author.name} (${author.id}), changed by ${session.email}`
    : "";
}

export const GET = adminRoute<Params>("masail.write", async (_request, session, params) =>
  adminJson(await getWorkspaceMasala(params.id, session)),
);

export const PUT = adminRoute<Params>("masail.write", async (request, session, params) => {
  const input = await readJson(request, masalaInput);
  const { previous, updated } = await updateMasala(params.id, input, session);
  const changes = [
    previous.question !== updated.question ? `question was "${previous.question}"` : null,
    previous.answer !== updated.answer ? "answer changed" : null,
    `${updated.sources.length} sources`,
    ownerNote(updated.author, session) || null,
  ].filter(Boolean);
  await recordAudit(
    session.email,
    "masail.update",
    updated.question.slice(0, 200),
    changes.join("; "),
  );
  if (previous.published !== updated.published) {
    await recordAudit(
      session.email,
      updated.published ? "masail.publish" : "masail.unpublish",
      updated.question.slice(0, 200),
    );
  }
  if (previous.published || updated.published) revalidateMasail(updated.id);
  return adminJson(updated);
});

export const PATCH = adminRoute<Params>("masail.write", async (request, session, params) => {
  const { published } = await readJson(request, publishInput);
  const { question, changed, detail } = await setMasalaPublished(params.id, published, session);
  if (changed) {
    await recordAudit(
      session.email,
      published ? "masail.publish" : "masail.unpublish",
      question.slice(0, 200),
      ownerNote(detail.author, session) || undefined,
    );
    revalidateMasail(detail.id);
  }
  return adminJson(detail);
});

export const DELETE = adminRoute<Params>("masail.write", async (_request, session, params) => {
  const removed = await deleteMasala(params.id, session);
  await recordAudit(
    session.email,
    "masail.delete",
    removed.question.slice(0, 200),
    ownerNote(removed.author ?? null, session) || undefined,
  );
  if (removed.published) revalidateMasail(removed._id.toHexString());
  return adminJson({ ok: true });
});
