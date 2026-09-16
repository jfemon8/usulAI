import { NextResponse } from "next/server";
import { feedbackSubmitInput } from "@/lib/analytics/feedbackInput";
import { recordFeedback } from "@/lib/analytics/feedback";
import { clientKey, consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limit = await consumeRateLimit("feedback", request);
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = feedbackSubmitInput.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    logger.warn("Feedback payload rejected", {
      field: String(issue?.path[0] ?? "body"),
      code: issue?.code ?? "unknown",
    });
    return NextResponse.json({ error: "মতামতের তথ্য সঠিক নয়।" }, { status: 400 });
  }

  try {
    const outcome = await recordFeedback({
      verdict: parsed.data.verdict,
      question: parsed.data.question,
      answer: parsed.data.answer,
      ...(parsed.data.note?.trim() ? { note: parsed.data.note.trim() } : {}),
      clientKey: clientKey(request),
      sources: parsed.data.sources.map((source) => ({ ...source, similarity: 0 })),
    });

    if (!outcome.recorded) {
      return NextResponse.json(
        { error: "এই উত্তরে আপনি আগেই মতামত দিয়েছেন।", verdict: outcome.verdict },
        { status: 409 },
      );
    }
    return NextResponse.json({ status: "ok", verdict: outcome.verdict });
  } catch (error) {
    logger.error("Feedback write failed", { error: String(error) });
    return NextResponse.json(
      { error: "মতামত সংরক্ষণ করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      { status: 500 },
    );
  }
}
