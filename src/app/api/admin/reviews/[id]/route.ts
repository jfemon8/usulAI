import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import { AdminError, adminJson, adminRoute, readJson } from "@/lib/admin/http";
import {
  claimReview,
  getReview,
  releaseReview,
  removeReview,
  toReviewDetail,
} from "@/lib/reviews/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

const claimInput = z.object({ action: z.enum(["claim", "release"]) });

export const GET = adminRoute<Params>("reviews.view", async (_request, session, params) =>
  adminJson(await getReview(params.id, session)),
);

export const PATCH = adminRoute<Params>("reviews.handle", async (request, session, params) => {
  const { action } = await readJson(request, claimInput);
  if (action === "release") {
    await releaseReview(params.id, session);
    return adminJson(await getReview(params.id, session));
  }
  const { item, takenFrom } = await claimReview(params.id, session);
  if (takenFrom) {
    await recordAudit(
      session.email,
      "reviews.takeover",
      item.question.slice(0, 200),
      `claim of ${takenFrom.email}`,
    );
  }
  return adminJson(toReviewDetail(item, session.principalId));
});

export const DELETE = adminRoute<Params>("reviews.handle", async (_request, session, params) => {
  if (session.role !== "admin") {
    throw new AdminError("রিভিউ সরাসরি মুছে ফেলার অনুমতি শুধু অ্যাডমিনের।", 403);
  }
  const removed = await removeReview(params.id);
  if (!removed) throw new AdminError("রিভিউটি পাওয়া যায়নি।", 404);
  await recordAudit(
    session.email,
    "reviews.delete",
    removed.question.slice(0, 200),
    `flagged ${removed.count}x`,
  );
  return adminJson({ ok: true });
});
