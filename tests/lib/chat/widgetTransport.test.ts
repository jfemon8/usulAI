import { afterEach, describe, expect, it, vi } from "vitest";
import { createWidgetTransport } from "../../../src/lib/chat/widgetTransport";
import type { UsulUIMessage } from "../../../src/types";

const answer =
  'data: {"type":"text-start","id":"text-1"}\n\n' +
  'data: {"type":"text-delta","id":"text-1","delta":"Complete answer"}\n\n' +
  'data: {"type":"text-end","id":"text-1"}\n\n' +
  "data: [DONE]\n\n";

afterEach(() => vi.unstubAllGlobals());

describe("widget chat transport", () => {
  it("starts a durable job and replays its answer as AI SDK stream chunks", async () => {
    const pending = vi.fn();
    const failed = vi.fn();
    const requests: { method?: string; url: string; signal: AbortSignal | null | undefined }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ method: init?.method, url, signal: init?.signal });
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { widgetJobId: string };
        expect(init.keepalive).toBe(true);
        expect(init.signal).toBeUndefined();
        return Response.json({ jobId: body.widgetJobId }, { status: 202 });
      }
      return Response.json({
        status: "complete",
        chunks: [Buffer.from(answer).toString("base64")],
        chunkCount: 1,
      });
    });

    const transport = createWidgetTransport({ onPending: pending, onFailure: failed });
    const messages: UsulUIMessage[] = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Question" }] },
    ];
    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages,
      abortSignal: undefined,
    });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);

    expect(pending).toHaveBeenCalledOnce();
    expect(pending).toHaveBeenCalledWith(expect.any(String), messages);
    expect(failed).not.toHaveBeenCalled();
    expect(chunks).toContainEqual({ type: "text-delta", id: "text-1", delta: "Complete answer" });
    expect(requests.some((request) => request.url.includes("/api/widget-chat/jobs/"))).toBe(true);
  });

  it("reconnects to the same job after the iframe mounts on another page", async () => {
    const jobId = "c09869c7-79e7-4ae3-98bb-6c9f0b011234";
    const fetchMock = vi.fn(async () =>
      Response.json({
        status: "complete",
        chunks: [Buffer.from(answer).toString("base64")],
        chunkCount: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const transport = createWidgetTransport({
      resumeJobId: jobId,
      onPending: vi.fn(),
      onFailure: vi.fn(),
    });
    const stream = await transport.reconnectToStream({ chatId: "chat-1" });
    const chunks = [];
    if (stream) for await (const chunk of stream) chunks.push(chunk);

    expect(chunks).toContainEqual({ type: "text-delta", id: "text-1", delta: "Complete answer" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/widget-chat/jobs/${jobId}?from=0`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
