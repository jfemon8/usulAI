import { DefaultChatTransport, UI_MESSAGE_STREAM_HEADERS } from "ai";
import type { UsulUIMessage } from "@/types";

interface WidgetJobUpdate {
  status: "running" | "complete" | "error";
  chunks: string[];
  chunkCount: number;
  error?: string;
}

function waitForNextPoll(signal: AbortSignal | undefined, delay = 400): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function readJobStream(
  id: string,
  signal: AbortSignal | undefined,
  onFailure: (id: string) => void,
): ReadableStream<Uint8Array> {
  let from = 0;
  const started = Date.now();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const response = await fetch(`/api/widget-chat/jobs/${id}?from=${from}`, {
            cache: "no-store",
            signal,
          });
          if (response.status === 404 && Date.now() - started < 5_000) {
            await waitForNextPoll(signal, 250);
            continue;
          }
          if (!response.ok) throw new Error("Could not resume answer generation.");
          const update = (await response.json()) as WidgetJobUpdate;
          if (!Array.isArray(update.chunks) || !Number.isSafeInteger(update.chunkCount)) {
            throw new Error("Invalid answer stream state.");
          }

          for (const encoded of update.chunks) {
            const binary = atob(encoded);
            controller.enqueue(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
          }
          from += update.chunks.length;

          if (update.status === "error" && from >= update.chunkCount) {
            throw new Error(update.error || "Answer generation failed.");
          }
          if (update.status === "complete" && from >= update.chunkCount) {
            controller.close();
            return;
          }
          if (update.status === "complete" && update.chunks.length === 0) {
            throw new Error("Answer stream is incomplete.");
          }
          if (update.chunks.length > 0) return;
          await waitForNextPoll(signal);
        }
      } catch (error) {
        if (!signal?.aborted) onFailure(id);
        controller.error(error);
      }
    },
  });
}

export function createWidgetTransport({
  resumeJobId,
  onPending,
  onFailure,
}: {
  resumeJobId?: string;
  onPending: (id: string, messages: UsulUIMessage[]) => void;
  onFailure: (id: string) => void;
}): DefaultChatTransport<UsulUIMessage> {
  return new DefaultChatTransport<UsulUIMessage>({
    api: "/api/widget-chat",
    prepareReconnectToStreamRequest: () => ({
      api: `/api/widget-chat/jobs/${resumeJobId}`,
    }),
    fetch: async (input, init) => {
      if (init?.method === "GET") {
        if (!resumeJobId) return new Response(null, { status: 204 });
        return new Response(readJobStream(resumeJobId, init.signal ?? undefined, onFailure), {
          headers: UI_MESSAGE_STREAM_HEADERS,
        });
      }

      const id = crypto.randomUUID();
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      body.widgetJobId = id;
      const serialized = JSON.stringify(body);
      onPending(id, body.messages as UsulUIMessage[]);
      const response = await fetch(input, {
        ...init,
        body: serialized,
        keepalive: serialized.length < 60_000,
        signal: undefined,
      });
      if (!response.ok) {
        onFailure(id);
        return response;
      }
      const startedJob = (await response.json()) as { jobId?: string };
      if (startedJob.jobId !== id) {
        onFailure(id);
        return new Response("Could not start answer generation.", { status: 502 });
      }
      return new Response(readJobStream(id, init?.signal ?? undefined, onFailure), {
        headers: UI_MESSAGE_STREAM_HEADERS,
      });
    },
  });
}
