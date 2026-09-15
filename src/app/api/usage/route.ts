import { NextResponse } from "next/server";
import { CHAT_HISTORY_CONFIG, RATE_LIMIT_CONFIG, USAGE_CONFIG } from "@/config/site";
import { consumeRateLimit, rateLimitResponse, readRateUsage } from "@/lib/security/rateLimit";
import type { UsageResponse } from "@/lib/usage/types";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = await consumeRateLimit("usage", request);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const now = Date.now();
    const entries = await Promise.all(
      USAGE_CONFIG.reportedScopes.map(
        async (scope) => [scope, await readRateUsage(scope, request, now)] as const,
      ),
    );

    const body: UsageResponse = {
      serverTime: now,
      scopes: Object.fromEntries(entries) as UsageResponse["scopes"],
      limits: {
        maxQuestionChars: RATE_LIMIT_CONFIG.maxQuestionChars,
        maxConversations: CHAT_HISTORY_CONFIG.maxConversations,
        maxMessagesPerConversation: CHAT_HISTORY_CONFIG.maxMessagesPerConversation,
        maxCompactMessages: CHAT_HISTORY_CONFIG.maxCompactMessages,
      },
    };

    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.warn("Usage lookup failed", { error: String(error).slice(0, 160) });
    return NextResponse.json(
      { error: "ব্যবহারের তথ্য এখন আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
