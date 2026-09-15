import { NextResponse } from "next/server";
import { z } from "zod";
import { SOURCE_PRIORITY } from "@/config/site";
import { recordFeedback } from "@/lib/analytics/feedback";
import { clientKey, consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

const submitSchema = z.object({
  verdict: z.enum(["helpful", "unhelpful", "wrong-citation"]),
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(8000),
  note: z.string().max(2000).optional(),
  sources: z
    .array(
      z.object({
        index: z.number(),
        sourceType: z.enum(SOURCE_PRIORITY),
        reference: z.string(),
      }),
    )
    .max(40),
});

export async function POST(request: Request) {
  const limit = await consumeRateLimit("feedback", request);
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = submitSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
  }

  try {
    await recordFeedback({
      verdict: parsed.data.verdict,
      question: parsed.data.question,
      answer: parsed.data.answer,
      clientKey: clientKey(request),
      sources: parsed.data.sources.map((source) => ({ ...source, similarity: 0 })),
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("Feedback write failed", { error: String(error) });
    return NextResponse.json({ error: "Could not record feedback" }, { status: 500 });
  }
}
