export type ReleaseSlot = () => void;

export const SLOT_LEVEL = { background: 0, interactive: 1, answer: 2 } as const;
export type SlotLevel = (typeof SLOT_LEVEL)[keyof typeof SLOT_LEVEL];

export interface SlotGate {
  acquire(level: SlotLevel, signal?: AbortSignal | null, maxWaitMs?: number): Promise<ReleaseSlot>;
  stats(): { running: number; waiting: number };
}

interface Waiter {
  level: SlotLevel;
  start: () => void;
}

export function createSlotGate(limit: number, reservedForAnswers: number): SlotGate {
  let running = 0;
  let runningLow = 0;
  const waiting: Waiter[] = [];

  const allowed = (level: SlotLevel) =>
    running < limit && (level === SLOT_LEVEL.answer || runningLow < limit - reservedForAnswers);

  const pump = () => {
    for (let index = 0; index < waiting.length;) {
      const waiter = waiting[index]!;
      if (allowed(waiter.level)) {
        waiting.splice(index, 1);
        waiter.start();
      } else {
        index += 1;
      }
    }
  };

  return {
    acquire(level, signal, maxWaitMs) {
      return new Promise<ReleaseSlot>((resolve, reject) => {
        if (signal?.aborted) {
          reject(signal.reason ?? new Error("aborted"));
          return;
        }

        const low = level !== SLOT_LEVEL.answer;
        const start = () => {
          running += 1;
          if (low) runningLow += 1;
          let released = false;
          resolve(() => {
            if (released) return;
            released = true;
            running -= 1;
            if (low) runningLow -= 1;
            pump();
          });
        };

        const queuedAhead = waiting.some((waiter) => waiter.level >= level);
        if (!queuedAhead && allowed(level)) {
          start();
          return;
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        const waiter: Waiter = {
          level,
          start: () => {
            clearTimeout(timer);
            start();
          },
        };
        const firstLower = waiting.findIndex((entry) => entry.level < level);
        if (firstLower >= 0) waiting.splice(firstLower, 0, waiter);
        else waiting.push(waiter);

        const leave = (reason: unknown) => {
          const index = waiting.indexOf(waiter);
          if (index < 0) return;
          waiting.splice(index, 1);
          clearTimeout(timer);
          reject(reason);
        };

        if (maxWaitMs !== undefined) {
          timer = setTimeout(
            () => leave(new Error("Rate limit reached for requests: local slot queue is full")),
            maxWaitMs,
          );
        }
        signal?.addEventListener("abort", () => leave(signal.reason ?? new Error("aborted")), {
          once: true,
        });
      });
    },
    stats: () => ({ running, waiting: waiting.length }),
  };
}

export function releaseWhenConsumed(
  response: Response,
  release: ReleaseSlot,
  abandon: ReleaseSlot = release,
): Response {
  if (!response.body) {
    release();
    return response;
  }

  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        abandon();
        controller.error(error);
      }
    },
    cancel(reason) {
      abandon();
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
