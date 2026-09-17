import { afterEach, describe, expect, it, vi } from "vitest";

class FakeElement {
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  listeners = new Map<string, EventListener[]>();
  innerHTML = "";
  title = "";
  type = "";
  src = "";

  constructor(readonly tagName: string) {}

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
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

async function loadWidget(viewport = { width: 390, height: 844 }) {
  const elements: FakeElement[] = [];
  const windowEvents = new Map<string, EventListener>();
  const storage = new Map<string, string>();
  const documentEvents = new Map<string, EventListener>();
  const document = {
    currentScript: { src: "https://usulai.onrender.com/widget.js" },
    documentElement: { clientWidth: viewport.width },
    createElement: (tag: string) => new FakeElement(tag),
    body: { appendChild: (element: FakeElement) => elements.push(element) },
    addEventListener: (type: string, listener: EventListener) => documentEvents.set(type, listener),
  };
  const window = {
    innerWidth: viewport.width,
    innerHeight: viewport.height,
    matchMedia: () => ({ matches: false }),
    addEventListener: (type: string, listener: EventListener) => windowEvents.set(type, listener),
  };

  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("getComputedStyle", () => ({ fontSize: "16px" }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => callback(0));

  vi.resetModules();
  await import("../../widget-src/loader");

  const bubble = elements.find((element) => element.tagName === "button");
  const frame = elements.find((element) => element.tagName === "iframe");
  if (!bubble || !frame) throw new Error("Widget was not mounted");

  return { bubble, frame, window, windowEvents, storage, document, documentEvents };
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
    const { bubble, frame } = await loadWidget();
    const event = pointer(340, 790);
    const restingLeft = bubble.style.left;
    const restingTop = bubble.style.top;

    expect(bubble.innerHTML).toContain("<svg");
    expect(bubble.style.opacity).toBe("0.5");
    expect(frame.src).toBe("https://usulai.onrender.com/embed");

    bubble.emit("pointerdown", event);
    bubble.emit("pointerup", event);
    bubble.emit("click", { detail: 1 });
    expect(bubble.getAttribute("aria-expanded")).toBe("true");
    expect(bubble.style.opacity).toBe("1");
    expect(frame.style.display).toBe("block");
    expect(frame.style.width).toBe("366px");
    expect(frame.style.height).toBe("680px");
    expect(bubble.style.left).not.toBe(restingLeft);
    vi.advanceTimersByTime(10_000);
    expect(bubble.style.opacity).toBe("1");

    bubble.emit("pointerdown", event);
    bubble.emit("pointerup", event);
    expect(bubble.getAttribute("aria-expanded")).toBe("false");
    expect(bubble.innerHTML).toContain("<svg");
    expect(bubble.style.left).toBe(restingLeft);
    expect(bubble.style.top).toBe(restingTop);
    vi.advanceTimersByTime(4_999);
    expect(bubble.style.opacity).toBe("1");
    vi.advanceTimersByTime(1);
    expect(bubble.style.opacity).toBe("0.5");
    expect(frame.style.display).toBe("none");
  });

  it("snaps when dragged near an edge, releases when dragged away, and saves its position", async () => {
    vi.useFakeTimers();
    const { bubble, storage, window, windowEvents, document: mockDocument } = await loadWidget();

    bubble.emit("pointerdown", pointer(340, 790));
    bubble.emit("pointermove", pointer(26, 22));
    bubble.emit("pointerup", pointer(26, 22));
    expect(bubble.style.left).toBe("0px");
    expect(bubble.style.top).toBe("0px");
    expect(bubble.getAttribute("aria-expanded")).toBe("false");
    expect(storage.has("usul-ai-widget-position-v1")).toBe(true);

    bubble.emit("pointerdown", pointer(28, 28));
    bubble.emit("pointermove", pointer(52, 52));
    bubble.emit("pointerup", pointer(52, 52));
    expect(bubble.style.left).toBe("24px");
    expect(bubble.style.top).toBe("24px");
    expect(bubble.style.opacity).toBe("1");
    vi.advanceTimersByTime(5_000);
    expect(bubble.style.opacity).toBe("0.5");

    window.innerWidth = 320;
    window.innerHeight = 568;
    mockDocument.documentElement.clientWidth = 320;
    windowEvents.get("resize")?.({} as Event);
    expect(Number.parseFloat(bubble.style.left ?? "NaN")).toBeLessThanOrEqual(320 - 56);
    expect(Number.parseFloat(bubble.style.top ?? "NaN")).toBeLessThanOrEqual(568 - 56);
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
});
