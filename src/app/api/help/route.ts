import { NextResponse } from "next/server";
import { HELP_CONFIG } from "@/config/site";
import { isSameOrigin } from "@/lib/admin/http";
import { createHelpRequest } from "@/lib/help/requests";
import { helpSubmitInput } from "@/lib/help/shape";
import { newTrackingToken } from "@/lib/help/tokens";
import { clientKey, consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

const FIELD_MESSAGES: Record<string, string> = {
  question: `প্রশ্নটি লিখুন (সর্বোচ্চ ${HELP_CONFIG.maxQuestionChars.toLocaleString("bn-BD")} অক্ষর)।`,
  details: `বিস্তারিত সর্বোচ্চ ${HELP_CONFIG.maxDetailsChars.toLocaleString("bn-BD")} অক্ষর হতে পারে।`,
  name: "নাম সর্বোচ্চ ৮০ অক্ষর হতে পারে।",
  email: "ইমেইল ঠিকানাটি সঠিক নয়।",
  context: "AI উত্তরের তথ্য সঠিক নয়।",
};

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return failure("অনুরোধটি অনুমোদিত নয়।", 403);

  const limit = await consumeRateLimit("helpRequest", request);
  if (!limit.allowed) return rateLimitResponse(limit, "অনুরোধ");

  const parsed = helpSubmitInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return failure(FIELD_MESSAGES[field] ?? "অনুরোধের তথ্য সঠিক নয়।", 400);
  }

  if (parsed.data.website?.trim()) {
    const token = newTrackingToken();
    return NextResponse.json(
      { token, path: `${HELP_CONFIG.path}/${token}`, createdAt: new Date().toISOString() },
      { status: 201, headers: NO_STORE },
    );
  }

  try {
    const { token, createdAt } = await createHelpRequest(parsed.data, clientKey(request));
    return NextResponse.json(
      { token, path: `${HELP_CONFIG.path}/${token}`, createdAt: createdAt.toISOString() },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    logger.error("Help request could not be stored", { error: String(error).slice(0, 160) });
    return failure("প্রশ্নটি এখন পাঠানো যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।", 503);
  }
}
