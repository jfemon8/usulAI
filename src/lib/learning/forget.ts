import { forgetRewrites } from "@/lib/ai/queryRewriter";
import { forgetTopic } from "@/lib/learning/memory";
import { forgetVerdicts } from "@/lib/retrieval/rerank";
import { logger } from "@/lib/utils/logger";

export async function forgetLearnedTopic(topic: string): Promise<void> {
  if (!topic) return;
  const cached = forgetRewrites(topic) + forgetVerdicts(topic);
  const stored = await forgetTopic(topic);
  if (cached + stored > 0) {
    logger.info("Forgot learned rewrites and judgements after negative feedback", {
      topic,
      cached,
      stored,
    });
  }
}
