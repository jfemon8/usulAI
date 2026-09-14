import { describe, expect, it } from "vitest";
import { createSlotGate, releaseWhenConsumed, SLOT_LEVEL } from "@/lib/ai/slotGate";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createSlotGate", () => {
  it("never lets background work take the slot kept for answers", async () => {
    const gate = createSlotGate(2, 1);
    const translation = await gate.acquire(SLOT_LEVEL.background);
    let rerankStarted = false;
    const rerank = gate.acquire(SLOT_LEVEL.background).then((release) => {
      rerankStarted = true;
      return release;
    });
    await tick();
    expect(rerankStarted).toBe(false);

    const answer = await gate.acquire(SLOT_LEVEL.answer);
    expect(gate.stats()).toEqual({ running: 2, waiting: 1 });

    translation();
    const releaseRerank = await rerank;
    expect(rerankStarted).toBe(true);
    answer();
    releaseRerank();
    expect(gate.stats()).toEqual({ running: 0, waiting: 0 });
  });

  it("serves a waiting answer before waiting background work", async () => {
    const gate = createSlotGate(1, 0);
    const first = await gate.acquire(SLOT_LEVEL.background);
    const order: string[] = [];
    const low = gate.acquire(SLOT_LEVEL.background).then((release) => {
      order.push("low");
      release();
    });
    const high = gate.acquire(SLOT_LEVEL.answer).then((release) => {
      order.push("answer");
      release();
    });

    first();
    await Promise.all([low, high]);
    expect(order).toEqual(["answer", "low"]);
  });

  it("gives up after the wait limit so the model chain can move on", async () => {
    const gate = createSlotGate(1, 0);
    const held = await gate.acquire(SLOT_LEVEL.background);

    await expect(gate.acquire(SLOT_LEVEL.interactive, null, 5)).rejects.toThrow(
      /Rate limit reached/,
    );
    expect(gate.stats()).toEqual({ running: 1, waiting: 0 });
    held();
  });

  it("leaves the queue when the request is aborted", async () => {
    const gate = createSlotGate(1, 0);
    const held = await gate.acquire(SLOT_LEVEL.answer);
    const controller = new AbortController();
    const waiting = gate.acquire(SLOT_LEVEL.answer, controller.signal);

    controller.abort(new Error("stopped"));
    await expect(waiting).rejects.toThrow("stopped");
    expect(gate.stats().waiting).toBe(0);
    held();
  });
});

describe("releaseWhenConsumed", () => {
  it("frees the slot only once the streamed body has been read", async () => {
    let released = 0;
    const response = releaseWhenConsumed(new Response("data: one\n\ndata: two\n\n"), () => {
      released += 1;
    });

    expect(released).toBe(0);
    expect(await response.text()).toContain("two");
    expect(released).toBe(1);
  });

  it("frees the slot when the reader cancels early", async () => {
    let released = 0;
    const response = releaseWhenConsumed(new Response("partial"), () => {
      released += 1;
    });

    await response.body!.cancel();
    expect(released).toBe(1);
  });
});

describe("abandoned requests", () => {
  it("uses the abandon callback when the reader cancels, because the server keeps generating", async () => {
    const calls: string[] = [];
    const response = releaseWhenConsumed(
      new Response("partial"),
      () => calls.push("done"),
      () => calls.push("abandoned"),
    );

    await response.body!.cancel();
    expect(calls).toEqual(["abandoned"]);
  });
});

describe("interactive calls ahead of background work", () => {
  it("starts a waiting rewrite before a waiting translation", async () => {
    const gate = createSlotGate(2, 1);
    const held = await gate.acquire(SLOT_LEVEL.background);
    const order: string[] = [];
    const translation = gate.acquire(SLOT_LEVEL.background).then((release) => {
      order.push("translation");
      release();
    });
    const rewrite = gate.acquire(SLOT_LEVEL.interactive).then((release) => {
      order.push("rewrite");
      release();
    });

    held();
    await Promise.all([translation, rewrite]);
    expect(order).toEqual(["rewrite", "translation"]);
  });
});
