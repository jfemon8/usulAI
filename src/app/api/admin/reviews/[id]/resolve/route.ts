import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { resolutionInput, resolveReviewItem } from "@/lib/reviews/resolve";
import { revalidateMasail } from "@/lib/reviews/revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const POST = adminRoute<Params>("reviews.handle", async (request, session, params) => {
  const input = await readJson(request, resolutionInput);
  const result = await resolveReviewItem(params.id, input, session);
  await recordAudit(
    session.email,
    `reviews.${result.action}`,
    result.question.slice(0, 200),
    result.detail,
  );
  if (result.masalaId) revalidateMasail(result.masalaId);
  return adminJson(result);
});
