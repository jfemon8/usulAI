import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/admin/http";
import { publicHelpStatuses } from "@/lib/help/requests";
import { helpStatusInput } from "@/lib/help/shape";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "অনুরোধটি অনুমোদিত নয়।" },
      { status: 403, headers: NO_STORE },
    );
  }

  const limit = await consumeRateLimit("helpTrack", request);
  if (!limit.allowed) return rateLimitResponse(limit, "অনুরোধ");

  const parsed = helpStatusInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "অনুরোধের তথ্য সঠিক নয়।" },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    return NextResponse.json(
      { items: await publicHelpStatuses(parsed.data.tokens) },
      { headers: NO_STORE },
    );
  } catch (error) {
    logger.warn("Help status lookup failed", { error: String(error).slice(0, 160) });
    return NextResponse.json(
      { error: "প্রশ্নগুলোর অবস্থা এখন আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      { status: 503, headers: NO_STORE },
    );
  }
}
