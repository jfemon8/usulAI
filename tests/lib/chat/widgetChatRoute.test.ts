import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/chat/route", () => ({ createChatResponse: vi.fn() }));
vi.mock("@/lib/chat/widgetJobs", () => ({
  createWidgetJob: vi.fn(),
  finishWidgetJob: vi.fn(),
  storeWidgetJobStream: vi.fn(),
  readWidgetJob: vi.fn(),
}));
vi.mock("@/lib/utils/afterResponse", () => ({ runAfterResponse: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({
  consumeRateLimit: vi.fn(),
  rateLimitResponse: vi.fn(),
}));

import { createChatResponse } from "@/app/api/chat/route";
import { GET as readJob } from "@/app/api/widget-chat/jobs/[id]/route";
import { POST as startJob } from "@/app/api/widget-chat/route";
import { createWidgetJob, readWidgetJob, storeWidgetJobStream } from "@/lib/chat/widgetJobs";
import { runAfterResponse } from "@/lib/utils/afterResponse";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";

const id = "c09869c7-79e7-4ae3-98bb-6c9f0b011234";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createWidgetJob).mockResolvedValue();
  vi.mocked(storeWidgetJobStream).mockResolvedValue();
  vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true });
});

describe("widget chat job routes", () => {
  it("starts generation after responding and keeps the original chat request", async () => {
    const messages = [{ id: "user-1", role: "user", parts: [{ type: "text", text: "Question" }] }];
    const chatResponse = new Response("data: [DONE]\n\n");
    vi.mocked(createChatResponse).mockResolvedValue(chatResponse);
    const response = await startJob(
      new Request("https://usulai.example/api/widget-chat", {
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.1" },
        body: JSON.stringify({ widgetJobId: id, messages }),
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ jobId: id });
    expect(createWidgetJob).toHaveBeenCalledWith(id);
    expect(createChatResponse).not.toHaveBeenCalled();

    const background = vi.mocked(runAfterResponse).mock.calls[0]?.[0];
    expect(background).toBeDefined();
    await background?.();
    const forwarded = vi.mocked(createChatResponse).mock.calls[0]?.[0];
    expect(forwarded?.headers.get("x-forwarded-for")).toBe("192.0.2.1");
    expect(await forwarded?.json()).toEqual({ messages });
    expect(createChatResponse).toHaveBeenCalledWith(forwarded, { rateLimitChecked: true });
    expect(storeWidgetJobStream).toHaveBeenCalledWith(id, chatResponse);
  });

  it("rejects invalid jobs before storing or running them", async () => {
    const response = await startJob(
      new Request("https://usulai.example/api/widget-chat", { method: "POST", body: "null" }),
    );
    expect(response.status).toBe(400);
    expect(createWidgetJob).not.toHaveBeenCalled();
    expect(runAfterResponse).not.toHaveBeenCalled();
  });

  it("applies chat rate limits before creating a background job", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      window: "minute",
      retryAfterSeconds: 30,
    });
    vi.mocked(rateLimitResponse).mockReturnValue(
      new Response("Too many requests", { status: 429 }),
    );
    const response = await startJob(
      new Request("https://usulai.example/api/widget-chat", {
        method: "POST",
        body: JSON.stringify({ widgetJobId: id, messages: [] }),
      }),
    );
    expect(response.status).toBe(429);
    expect(createWidgetJob).not.toHaveBeenCalled();
  });

  it("returns stored chunks for a resumed answer", async () => {
    const snapshot = { status: "running" as const, chunks: ["YWJj"], chunkCount: 1 };
    vi.mocked(readWidgetJob).mockResolvedValue(snapshot);
    const response = await readJob(
      new Request(`https://usulai.example/api/widget-chat/jobs/${id}?from=2`),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(readWidgetJob).toHaveBeenCalledWith(id, 2);
  });
});
