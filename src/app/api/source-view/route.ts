import { NextResponse } from "next/server";
import { SOURCE_VIEW_CONFIG } from "@/config/site";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { loadSourceView } from "@/lib/sourceView/loadSourceView";
import { renderSourcePdf } from "@/lib/sourceView/renderSourcePdf";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const reference = params.get("ref")?.trim();
  const prefetch = params.get("prefetch") === "1";

  if (!reference || reference.length > SOURCE_VIEW_CONFIG.maxReferenceChars) {
    return NextResponse.json({ error: "সূত্রটি সঠিক নয়।" }, { status: 400 });
  }

  const limit = await consumeRateLimit("sourceView", request);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const view = await loadSourceView(reference, prefetch ? { translationWaitMs: 0 } : {});
    if (!view) {
      return NextResponse.json({ error: "এই সূত্রটি খুঁজে পাওয়া যায়নি।" }, { status: 404 });
    }

    const { pdf, highlight } = await renderSourcePdf(view);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="source.pdf"; filename*=UTF-8''${encodeURIComponent(`${view.reference}.pdf`)}`,
        "cache-control": view.translationPending
          ? "no-store"
          : `public, max-age=${SOURCE_VIEW_CONFIG.cacheSeconds}, s-maxage=${SOURCE_VIEW_CONFIG.cacheSeconds}`,
        ...(view.translationPending ? { "x-translation-pending": "1" } : {}),
        ...(view.externalUrl ? { "x-source-external-url": view.externalUrl } : {}),
        ...(highlight
          ? {
              "x-highlight-page": String(highlight.page),
              "x-highlight-top": highlight.top.toFixed(4),
            }
          : {}),
      },
    });
  } catch (error) {
    logger.error("Source view failed", { reference, error: String(error) });
    return NextResponse.json({ error: "সূত্রটি এখন দেখানো যাচ্ছে না।" }, { status: 500 });
  }
}
