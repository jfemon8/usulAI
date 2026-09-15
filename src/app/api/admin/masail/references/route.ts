import { z } from "zod";
import { ANSWER_LIMITS, answerSourceInput, resolveSources } from "@/lib/admin/answers";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkSchema = z.object({
  sources: z.array(answerSourceInput).min(1).max(ANSWER_LIMITS.maxSources),
});

export const POST = adminRoute(["masail.write", "reviews.handle"], async (request) => {
  const { sources } = await readJson(request, checkSchema);
  const { checks } = await resolveSources(sources);
  return adminJson({ checks });
});
