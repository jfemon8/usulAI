import { NextResponse } from "next/server";
import { z } from "zod";
import { listReviewQueue, recordFeedback, resolveReview } from "@/lib/analytics/feedback";
import { getAppEnv } from "@/lib/utils/env";
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
        sourceType: z.enum(["quran", "hadith", "ijma", "qiyas", "sirat"]),
        reference: z.string(),
      }),
    )
    .max(40),
});

const resolveSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
  reviewerNote: z.string().max(2000).optional(),
  correctedAnswer: z.string().max(8000).optional(),
});

function isReviewer(request: Request): boolean {
  return request.headers.get("x-review-secret") === getAppEnv().INGEST_API_SECRET;
}

export async function POST(request: Request) {
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
  }

  try {
    const id = await recordFeedback({
      verdict: parsed.data.verdict,
      question: parsed.data.question,
      answer: parsed.data.answer,
      note: parsed.data.note,
      sources: parsed.data.sources.map((source) => ({ ...source, similarity: 0 })),
    });

    return NextResponse.json({ status: "ok", id });
  } catch (error) {
    logger.error("Feedback write failed", { error: String(error) });
    return NextResponse.json({ error: "Could not record feedback" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isReviewer(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ pending: await listReviewQueue() });
}

export async function PATCH(request: Request) {
  if (!isReviewer(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = resolveSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
  }

  const updated = await resolveReview(
    parsed.data.id,
    parsed.data.status,
    parsed.data.reviewerNote,
    parsed.data.correctedAnswer,
  );

  return updated
    ? NextResponse.json({ status: "ok" })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
