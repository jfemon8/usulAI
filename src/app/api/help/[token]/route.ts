import { NextResponse } from "next/server";
import { publicHelpRequest } from "@/lib/help/requests";
import { isHelpTokenShape } from "@/lib/help/tokens";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
const NOT_FOUND =
  "এই লিংকে কোনো প্রশ্ন পাওয়া যায়নি। লিংকটি ভুল হতে পারে বা প্রশ্নটির মেয়াদ শেষ হয়ে গেছে।";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const limit = await consumeRateLimit("helpTrack", request);
  if (!limit.allowed) return rateLimitResponse(limit, "অনুরোধ");

  const { token } = await context.params;
  if (!isHelpTokenShape(token)) {
    return NextResponse.json({ error: NOT_FOUND }, { status: 404, headers: HEADERS });
  }

  try {
    const view = await publicHelpRequest(token);
    if (!view) return NextResponse.json({ error: NOT_FOUND }, { status: 404, headers: HEADERS });
    return NextResponse.json(view, { headers: HEADERS });
  } catch (error) {
    logger.warn("Help request lookup failed", { error: String(error).slice(0, 160) });
    return NextResponse.json(
      { error: "প্রশ্নের অবস্থা এখন আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      { status: 503, headers: HEADERS },
    );
  }
}
