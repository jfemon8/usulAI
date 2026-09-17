import { createChatResponse } from "@/app/api/chat/route";
import { createWidgetJob, finishWidgetJob, storeWidgetJobStream } from "@/lib/chat/widgetJobs";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { runAfterResponse } from "@/lib/utils/afterResponse";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 150_000) return new Response("Chat request is too large.", { status: 413 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return new Response("Invalid chat request.", { status: 400 });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return new Response("Invalid chat request.", { status: 400 });
  }
  const body = parsed as { widgetJobId?: unknown; messages?: unknown };
  if (!JOB_ID.test(String(body.widgetJobId ?? "")) || !Array.isArray(body.messages)) {
    return new Response("Invalid chat request.", { status: 400 });
  }

  const limit = await consumeRateLimit("chat", request);
  if (!limit.allowed) return rateLimitResponse(limit);

  const id = String(body.widgetJobId);
  try {
    await createWidgetJob(id);
  } catch (error) {
    logger.error("Could not start widget chat job", { error: String(error), id });
    return new Response("Could not start answer generation.", { status: 503 });
  }

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  const chatRequestUrl = new URL("/api/chat", request.url);
  const messages = body.messages;
  runAfterResponse(async () => {
    try {
      const chatRequest = new Request(chatRequestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages }),
      });
      const response = await createChatResponse(chatRequest, { rateLimitChecked: true });
      await storeWidgetJobStream(id, response);
    } catch (error) {
      logger.error("Widget chat job failed", { error: String(error), id });
      await finishWidgetJob(id, "Answer generation failed. Please try again.");
    }
  });

  return Response.json({ jobId: id }, { status: 202, headers: { "cache-control": "no-store" } });
}
