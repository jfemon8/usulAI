import { NextResponse } from "next/server";
import { z } from "zod";
import { browserCacheControl, CLIENT_CACHE_CONFIG, MASAIL_CONFIG } from "@/config/site";
import { listPublishedMasail } from "@/lib/analytics/verifiedAnswers";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  search: z.string().trim().max(MASAIL_CONFIG.maxSearchChars).optional(),
  cursor: z
    .string()
    .regex(/^\d{1,15}_[a-f0-9]{24}$/)
    .optional(),
});

export async function GET(request: Request) {
  const limit = await consumeRateLimit("masail", request);
  if (!limit.allowed) return rateLimitResponse(limit, "অনুরোধ");

  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    search: params.get("search") || undefined,
    cursor: params.get("cursor") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "অনুরোধের তথ্য সঠিক নয়।" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const page = await listPublishedMasail({
      search: parsed.data.search,
      cursor: parsed.data.cursor ?? null,
    });
    return NextResponse.json(page, {
      headers: { "cache-control": browserCacheControl(CLIENT_CACHE_CONFIG.masailList) },
    });
  } catch (error) {
    logger.warn("Masail list failed", { error: String(error).slice(0, 160) });
    return NextResponse.json(
      { error: "এখন মাসআলা আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
