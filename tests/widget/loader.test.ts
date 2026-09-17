import { afterEach, describe, expect, it, vi } from "vitest";
import { BUBBLE_SIZE } from "../../widget-src/layout";
import { WIDGET_CHAT_KEY, WIDGET_MESSAGE_SOURCE, WIDGET_VISIT_KEY } from "../../widget-src/session";

class FakeElement {
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  listeners = new Map<string, EventListener[]>();
  innerHTML = "";
  title = "";
  type = "";
  src = "";
  contentWindow = { postMessage: vi.fn() };

  constructor(readonly tagName: string) {}

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  contains(target: unknown) {
    return target === this;
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, event: Record<string, unknown> = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event as unknown as Event);
  }

  setPointerCapture() {}
  releasePointerCapture() {}
}

async function loadWidget(
  viewport = { width: 390, height: 844 },
  options: {
    hostUrl?: string;
    referrer?: string;
    navigationType?: string;
    sessionStore?: Map<string, string>;
  } = {},
) {
  const elements: FakeElement[] = [];
  const windowEvents = new Map<string, EventListener>();
  const storage = new Map<string, string>();
  const sessionStore = options.sessionStore ?? new Map<string, string>();
  const documentEvents = new Map<string, EventListener>();
  const document = {
    currentScript: { src: "https://usulai.onrender.com/widget.js" },
    referrer: options.referrer ?? "",
    documentElement: { clientWidth: viewport.width },
    createElement: (tag: string) => new FakeElement(tag),
    body: { appendChild: (element: FakeElement) => elements.push(element) },
    addEventListener: (type: string, listener: EventListener) => documentEvents.set(type, listener),
  };
  const window = {
    innerWidth: viewport.width,
    innerHeight: viewport.height,
    location: new URL(options.hostUrl ?? "https://host.example/page-one"),
    performance: { getEntriesByType: () => [{ type: options.navigationType ?? "navigate" }] },
    matchMedia: () => ({ matches: false }),
    addEventListener: (type: string, listener: EventListener) => windowEvents.set(type, listener),
  };

  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("Node", FakeElement);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => sessionStore.set(key, value),
    removeItem: (key: string) => sessionStore.delete(key),
  });
  vi.stubGlobal("getComputedStyle", () => ({ fontSize: "16px" }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => callback(0));

  vi.resetModules();
  await import("../../widget-src/loader");

  const bubble = elements.find((element) => element.tagName === "button");
  const frame = elements.find((element) => element.tagName === "iframe");
  const headPointer = elements.find((element) => element.tagName === "div");
  if (!bubble || !frame || !headPointer) throw new Error("Widget was not mounted");

  return {
    bubble,
    frame,
    headPointer,
    window,
    windowEvents,
    storage,
    sessionStore,
    document,
    documentEvents,
  };
}

function pointer(x: number, y: number) {
  return {
    isPrimary: true,
    pointerType: "mouse",
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("floating widget interactions", () => {
  it("shows only the logo and fades five seconds after the chat closes", async () => {
    vi.useFakeTimers();
    const { bubble, frame, headPointer } = await loadWidget();
    const event = pointer(340, 790);
    const restingLeft = bubble.style.left;
    const restingTop = bubble.style.top;

    expect(bubble.innerHTML).toContain("<svg");
    expect(bubble.innerHTML).toContain("calc(100% - 4px)");
    expect(bubble.style.width).toBe("3rem");
    expect(bubble.style.height).toBe("3rem");
    expect(bubble.style.background).toBe("#d6dbe3");
    expect(bubble.style.padding).toBe("0");
    expect(bubble.style.opacity).toBe("0.5");
    expect(new URL(frame.src).pathname).toBe("/embed");
    expect(new URL(frame.src).searchParams.get("widgetOrigin")).toBe("https://host.example");

    bubble.emit("pointerdown", event);
    bubble.emit("pointerup", event);
    bubble.emit("click", { detail: 1 });
    expect(bubble.getAttribute("aria-expanded")).toBe("true");
    expect(bubble.style.opacity).toBe("1");
    expect(frame.style.display).toBe("block");
    expect(frame.style.width).toBe("366px");
    expect(frame.style.height).toBe("680px");
    expect(bubble.style.left).not.toBe(restingLeft);
    expect(bubble.style.left).toBe(`${Number.parseFloat(frame.style.left ?? "0") + 8}px`);
    expect(headPointer.style.display).toBe("block");
    expect(headPointer.style.borderBottom).toBe("10px solid #ffffff");
    vi.advanceTimersByTime(10_000);
    expect(bubble.style.opacity).toBe("1");

    const close = pointer(
      Number.parseFloat(bubble.style.left ?? "0") + 28,
      Number.parseFloat(bubble.style.top ?? "0") + 28,
    );
    bubble.emit("pointerdown", close);
    bubble.emit("pointerup", close);
    expect(bubble.getAttribute("aria-expanded")).toBe("false");
    expect(bubble.innerHTML).toContain("<svg");
    expect(bubble.style.left).toBe(restingLeft);
    expect(bubble.style.top).toBe(restingTop);
    vi.advanceTimersByTime(4_999);
    expect(bubble.style.opacity).toBe("1");
    vi.advanceTimersByTime(1);
    expect(bubble.style.opacity).toBe("0.5");
    expect(frame.style.display).toBe("none");
    expect(headPointer.style.display).toBe("none");
  });

  it("snaps when dragged near an edge, releases when dragged away, and saves its position", async () => {
    vi.useFakeTimers();
    const { bubble, storage, window, windowEvents, document: mockDocument } = await loadWidget();

    bubble.emit("pointerdown", pointer(340, 790));
    bubble.emit("pointermove", pointer(26, 22));
    bubble.emit("pointerup", pointer(26, 22));
    expect(bubble.style.left).toBe("0px");
    expect(bubble.style.top).toBe("0px");
    expect(bubble.style.borderRadius).toBe("0 0 24px 0");
    expect(bubble.getAttribute("aria-expanded")).toBe("false");
    expect(storage.has("usul-ai-widget-position-v1")).toBe(true);

    bubble.emit("pointerdown", pointer(28, 28));
    bubble.emit("pointermove", pointer(52, 52));
    bubble.emit("pointerup", pointer(52, 52));
    expect(bubble.style.left).toBe("24px");
    expect(bubble.style.top).toBe("24px");
    expect(bubble.style.borderRadius).toBe("24px 24px 24px 24px");
    expect(bubble.style.opacity).toBe("1");
    vi.advanceTimersByTime(5_000);
    expect(bubble.style.opacity).toBe("0.5");

    window.innerWidth = 320;
    window.innerHeight = 568;
    mockDocument.documentElement.clientWidth = 320;
    windowEvents.get("resize")?.({} as Event);
    expect(Number.parseFloat(bubble.style.left ?? "NaN")).toBeLessThanOrEqual(320 - BUBBLE_SIZE);
    expect(Number.parseFloat(bubble.style.top ?? "NaN")).toBeLessThanOrEqual(568 - BUBBLE_SIZE);
  });

  it("keeps the open panel and bubble fixed, then returns the bubble on close", async () => {
    vi.useFakeTimers();
    const { bubble, frame, storage } = await loadWidget({ width: 1440, height: 900 });
    const resting = { left: bubble.style.left, top: bubble.style.top };
    const start = pointer(
      Number.parseFloat(bubble.style.left ?? "0") + 28,
      Number.parseFloat(bubble.style.top ?? "0") + 28,
    );

    bubble.emit("pointerdown", start);
    bubble.emit("pointerup", start);
    const open = {
      left: Number.parseFloat(bubble.style.left ?? "0"),
      top: Number.parseFloat(bubble.style.top ?? "0"),
      frameLeft: Number.parseFloat(frame.style.left ?? "0"),
      frameTop: Number.parseFloat(frame.style.top ?? "0"),
    };

    bubble.emit("pointerdown", pointer(open.left + 28, open.top + 28));
    bubble.emit("pointermove", pointer(open.left - 72, open.top - 72));
    bubble.emit("pointerup", pointer(open.left - 72, open.top - 72));
    expect(Number.parseFloat(bubble.style.left ?? "0")).toBe(open.left);
    expect(Number.parseFloat(bubble.style.top ?? "0")).toBe(open.top);
    expect(Number.parseFloat(frame.style.left ?? "0")).toBe(open.frameLeft);
    expect(Number.parseFloat(frame.style.top ?? "0")).toBe(open.frameTop);
    expect(bubble.getAttribute("aria-expanded")).toBe("true");
    expect(storage.has("usul-ai-widget-position-v1")).toBe(false);

    const close = pointer(open.left + 28, open.top + 28);
    bubble.emit("pointerdown", close);
    bubble.emit("pointerup", close);
    expect(bubble.style.left).toBe(resting.left);
    expect(bubble.style.top).toBe(resting.top);
  });

  it("points from the panel's upper-left side to the chat head in landscape", async () => {
    vi.useFakeTimers();
    const { bubble, frame, headPointer } = await loadWidget({ width: 844, height: 390 });
    const start = pointer(
      Number.parseFloat(bubble.style.left ?? "0") + 28,
      Number.parseFloat(bubble.style.top ?? "0") + 28,
    );

    bubble.emit("pointerdown", start);
    bubble.emit("pointerup", start);

    expect(frame.style.width).toBe("420px");
    expect(frame.style.height).toBe("366px");
    expect(headPointer.style.borderRight).toBe("10px solid #ffffff");
    expect(Number.parseFloat(bubble.style.left ?? "0") + BUBBLE_SIZE + 12).toBe(
      Number.parseFloat(frame.style.left ?? "0"),
    );
    expect(Number.parseFloat(bubble.style.top ?? "0")).toBe(
      Number.parseFloat(frame.style.top ?? "0") + 8,
    );
  });

  it("closes when the host page receives a pointer press outside the panel", async () => {
    const { bubble, frame, documentEvents } = await loadWidget();
    const event = pointer(340, 790);
    bubble.emit("pointerdown", event);
    bubble.emit("pointerup", event);
    expect(bubble.getAttribute("aria-expanded")).toBe("true");

    documentEvents.get("pointerdown")?.({ target: frame } as unknown as Event);
    expect(bubble.getAttribute("aria-expanded")).toBe("true");
    documentEvents.get("pointerdown")?.({ target: new FakeElement("main") } as unknown as Event);
    expect(bubble.getAttribute("aria-expanded")).toBe("false");
  });

  it("restores the chat on an internal page and starts fresh after leaving the site", async () => {
    const first = await loadWidget();
    const firstVisit = new URL(first.frame.src).searchParams.get("widgetVisit");
    const chat = { id: "chat-1", messages: [{ id: "m-1", role: "user", parts: [] }] };
    first.windowEvents.get("message")?.({
      origin: "https://usulai.onrender.com",
      source: first.frame.contentWindow,
      data: { source: WIDGET_MESSAGE_SOURCE, type: "save", visitId: firstVisit, chat },
    } as unknown as Event);
    expect(first.sessionStore.has(WIDGET_CHAT_KEY)).toBe(true);

    const second = await loadWidget(undefined, {
      hostUrl: "https://host.example/page-two",
      referrer: "https://host.example/page-one",
      sessionStore: first.sessionStore,
    });
    expect(new URL(second.frame.src).searchParams.get("widgetVisit")).toBe(firstVisit);
    second.windowEvents.get("message")?.({
      origin: "https://usulai.onrender.com",
      source: second.frame.contentWindow,
      data: { source: WIDGET_MESSAGE_SOURCE, type: "ready", visitId: firstVisit },
    } as unknown as Event);
    expect(second.frame.contentWindow.postMessage).toHaveBeenCalledWith(
      { source: WIDGET_MESSAGE_SOURCE, type: "restore", visitId: firstVisit, chat },
      "https://usulai.onrender.com",
    );

    const third = await loadWidget(undefined, {
      hostUrl: "https://host.example/page-one",
      referrer: "https://another.example/",
      sessionStore: first.sessionStore,
    });
    expect(new URL(third.frame.src).searchParams.get("widgetVisit")).not.toBe(firstVisit);
    expect(third.sessionStore.has(WIDGET_CHAT_KEY)).toBe(false);
  });

  it("clears the visit when returning from an external link through browser history", async () => {
    const { frame, sessionStore, windowEvents, documentEvents } = await loadWidget();
    const originalVisit = sessionStore.get(WIDGET_VISIT_KEY);
    sessionStore.set(
      WIDGET_CHAT_KEY,
      JSON.stringify({ id: "chat-1", messages: [{ id: "m-1", role: "user", parts: [] }] }),
    );
    documentEvents.get("click")?.({
      target: {
        closest: () => ({
          href: "https://another.example/",
          hasAttribute: () => false,
          getAttribute: () => null,
        }),
      },
    } as unknown as Event);
    windowEvents.get("pagehide")?.({} as Event);
    expect(sessionStore.has(WIDGET_CHAT_KEY)).toBe(false);
    windowEvents.get("pageshow")?.({ persisted: true } as unknown as Event);
    expect(sessionStore.get(WIDGET_VISIT_KEY)).not.toBe(originalVisit);
    expect(new URL(frame.src).searchParams.get("widgetVisit")).toBe(
      sessionStore.get(WIDGET_VISIT_KEY),
    );
  });

  it("carries a running answer into the next page and clears the job when it finishes", async () => {
    const first = await loadWidget();
    const visitId = new URL(first.frame.src).searchParams.get("widgetVisit");
    const jobId = "c09869c7-79e7-4ae3-98bb-6c9f0b011234";
    const user = { id: "user-1", role: "user", parts: [{ type: "text", text: "Question" }] };
    first.windowEvents.get("message")?.({
      origin: "https://usulai.onrender.com",
      source: first.frame.contentWindow,
      data: {
        source: WIDGET_MESSAGE_SOURCE,
        type: "pending",
        visitId,
        chatId: "chat-1",
        jobId,
        messages: [user],
      },
    } as unknown as Event);

    const second = await loadWidget(undefined, {
      hostUrl: "https://host.example/page-two",
      referrer: "https://host.example/page-one",
      sessionStore: first.sessionStore,
    });
    second.windowEvents.get("message")?.({
      origin: "https://usulai.onrender.com",
      source: second.frame.contentWindow,
      data: { source: WIDGET_MESSAGE_SOURCE, type: "ready", visitId },
    } as unknown as Event);
    expect(second.frame.contentWindow.postMessage).toHaveBeenCalledWith(
      {
        source: WIDGET_MESSAGE_SOURCE,
        type: "restore",
        visitId,
        chat: { id: "chat-1", messages: [user], pendingJobId: jobId },
      },
      "https://usulai.onrender.com",
    );

    second.windowEvents.get("message")?.({
      origin: "https://usulai.onrender.com",
      source: second.frame.contentWindow,
      data: {
        source: WIDGET_MESSAGE_SOURCE,
        type: "save",
        visitId,
        chat: {
          id: "chat-1",
          messages: [user, { id: "assistant-1", role: "assistant", parts: [] }],
        },
      },
    } as unknown as Event);
    expect(JSON.parse(second.sessionStore.get(WIDGET_CHAT_KEY) ?? "null")).toEqual({
      id: "chat-1",
      messages: [user, { id: "assistant-1", role: "assistant", parts: [] }],
    });
  });
});
