import { z } from "zod";
import { answerSourceInput, ANSWER_LIMITS, resolveSources } from "@/lib/admin/answers";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  sources: z.array(answerSourceInput).min(1).max(ANSWER_LIMITS.maxSources),
});

export const POST = adminRoute("help.handle", async (request) => {
  const { sources } = await readJson(request, input);
  const { checks } = await resolveSources(sources);
  return adminJson({ checks });
});
