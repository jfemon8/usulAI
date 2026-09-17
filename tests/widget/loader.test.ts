import { afterEach, describe, expect, it, vi } from "vitest";
import { BUBBLE_SIZE } from "../../widget-src/layout";
import { WIDGET_CHAT_KEY, WIDGET_MESSAGE_SOURCE, WIDGET_VISIT_KEY } from "../../widget-src/session";

class FakeElement {
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  listeners = new Map<string, EventListener[]>();
  children: FakeElement[] = [];
  innerHTML = "";
  textContent = "";
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

  contains(target: unknown): boolean {
    return target === this || this.children.some((child) => child.contains(target));
  }

  append(...children: FakeElement[]) {
    this.children.push(...children);
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
    localStore?: Map<string, string>;
    darkMode?: boolean;
  } = {},
) {
  const elements: FakeElement[] = [];
  const windowEvents = new Map<string, EventListener>();
  const storage = options.localStore ?? new Map<string, string>();
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
    matchMedia: () => ({ matches: options.darkMode ?? false }),
    addEventListener: (type: string, listener: EventListener) => windowEvents.set(type, listener),
  };

  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("Node", FakeElement);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
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
  const bubbleMenu = elements.find(
    (element) => element.getAttribute("aria-label") === "Hide Usul AI chat bubble",
  );
  const bubbleMenuPointer = elements.find(
    (element) => element !== headPointer && element.getAttribute("aria-hidden") === "true",
  );
  const edgeBar = elements.find(
    (element) => element.getAttribute("aria-label") === "Usul AI hidden chat tab",
  );
  const barMenu = elements.find(
    (element) => element.getAttribute("aria-label") === "Usul AI hidden chat actions",
  );
  if (
    !bubble ||
    !frame ||
    !headPointer ||
    !bubbleMenu ||
    !bubbleMenuPointer ||
    !edgeBar ||
    !barMenu
  ) {
    throw new Error("Widget was not mounted");
  }

  return {
    bubble,
    frame,
    headPointer,
    bubbleMenu,
    bubbleMenuPointer,
    edgeBar,
    barMenu,
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

  it("opens hide options on hold, keeps the edge tab draggable, and restores the bubble", async () => {
    vi.useFakeTimers();
    const { bubble, bubbleMenu, bubbleMenuPointer, edgeBar, barMenu, documentEvents, storage } =
      await loadWidget();
    const press = pointer(340, 790);

    bubble.emit("pointerdown", press);
    vi.advanceTimersByTime(599);
    expect(bubbleMenu.style.display).toBe("none");
    vi.advanceTimersByTime(1);
    expect(bubbleMenu.style.display).toBe("flex");
    expect(bubbleMenu.style.background).toBe("#f8fafc");
    expect(bubbleMenuPointer.style.display).toBe("block");
    expect(bubbleMenuPointer.style.borderTop).toBe("8px solid #f8fafc");
    bubbleMenu.children[0]!.emit("mouseenter");
    expect(bubbleMenu.children[0]!.style.background).toBe("#e7edf5");
    bubbleMenu.children[0]!.emit("mouseleave");
    expect(bubbleMenu.children[0]!.style.background).toBe("transparent");
    expect(bubble.style.opacity).toBe("1");
    bubble.emit("pointerup", press);
    expect(bubble.getAttribute("aria-expanded")).toBe("false");
    documentEvents.get("pointerdown")?.({ target: new FakeElement("main") } as unknown as Event);
    expect(bubbleMenu.style.display).toBe("none");
    expect(bubbleMenuPointer.style.display).toBe("none");

    bubble.emit("pointerdown", press);
    vi.advanceTimersByTime(600);
    bubble.emit("pointerup", press);
    bubbleMenu.children[0]!.emit("click");
    expect(bubble.style.display).toBe("none");
    expect(edgeBar.style.display).toBe("block");
    expect(edgeBar.style.width).toBe("8px");
    expect(edgeBar.style.left).toBe("0px");
    expect(edgeBar.style.borderRadius).toBe("0 8px 8px 0");
    expect(edgeBar.textContent).toBe("");
    expect(barMenu.style.width).toBe("0px");
    expect(edgeBar.style.opacity).toBe("1");
    vi.advanceTimersByTime(5_000);
    expect(edgeBar.style.opacity).toBe("0.75");

    const startY = Number.parseFloat(edgeBar.style.top ?? "NaN");
    edgeBar.emit("pointerdown", pointer(8, startY + 10));
    edgeBar.emit("pointermove", pointer(100, startY - 190));
    edgeBar.emit("pointerup", pointer(100, startY - 190));
    expect(edgeBar.style.left).toBe("0px");
    expect(Number.parseFloat(edgeBar.style.top ?? "NaN")).toBe(startY - 200);
    expect(storage.has("usul-ai-widget-hidden-v1")).toBe(true);

    edgeBar.emit("pointerdown", pointer(8, startY - 190));
    edgeBar.emit("pointerup", pointer(8, startY - 190));
    expect(barMenu.style.width).toBe("132px");
    expect(barMenu.style.left).toBe("8px");
    expect(barMenu.style.top).toBe(edgeBar.style.top);
    expect(barMenu.style.background).toBe(edgeBar.style.background);
    expect(edgeBar.style.borderRadius).toBe("0");
    expect(barMenu.children[0]!.textContent).toBe("Show UsulAI");
    barMenu.children[0]!.emit("mouseenter");
    expect(barMenu.children[0]!.style.background).toBe("#6a4b91");
    barMenu.children[0]!.emit("mouseleave");
    vi.advanceTimersByTime(10_000);
    expect(edgeBar.style.opacity).toBe("1");
    documentEvents.get("pointerdown")?.({ target: new FakeElement("main") } as unknown as Event);
    expect(barMenu.style.width).toBe("0px");
    expect(edgeBar.style.borderRadius).toBe("0");
    barMenu.emit("transitionend", { target: barMenu, propertyName: "width" });
    expect(edgeBar.style.borderRadius).toBe("0 8px 8px 0");
    vi.advanceTimersByTime(5_000);
    expect(edgeBar.style.opacity).toBe("0.75");

    edgeBar.emit("pointerdown", pointer(8, startY - 190));
    edgeBar.emit("pointerup", pointer(8, startY - 190));
    barMenu.children[0]!.emit("click");
    expect(edgeBar.style.display).toBe("none");
    expect(bubble.style.display).toBe("flex");
    expect(bubble.style.left).toBe("0px");
    expect(storage.has("usul-ai-widget-hidden-v1")).toBe(false);
  });

  it("keeps a hidden right tab at its saved height after page navigation", async () => {
    vi.useFakeTimers();
    const first = await loadWidget();
    first.bubble.emit("pointerdown", pointer(340, 790));
    vi.advanceTimersByTime(600);
    first.bubble.emit("pointerup", pointer(340, 790));
    first.bubbleMenu.children[1]!.emit("click");
    first.edgeBar.emit("pointerdown", pointer(382, 780));
    first.edgeBar.emit("pointermove", pointer(200, 110));
    first.edgeBar.emit("pointerup", pointer(200, 110));
    const savedTop = first.edgeBar.style.top;

    const second = await loadWidget(undefined, { localStore: first.storage });
    expect(second.bubble.style.display).toBe("none");
    expect(second.edgeBar.style.display).toBe("block");
    expect(second.edgeBar.style.width).toBe("8px");
    expect(second.edgeBar.style.left).toBe("382px");
    expect(second.edgeBar.style.borderRadius).toBe("8px 0 0 8px");
    expect(second.edgeBar.textContent).toBe("");
    expect(second.barMenu.style.right).toBe("8px");
    expect(second.edgeBar.style.top).toBe(savedTop);
    expect(second.edgeBar.style.opacity).toBe("0.75");
  });

  it("uses a 16px edge tab on desktop and halves it when resized to mobile", async () => {
    vi.useFakeTimers();
    const { bubble, bubbleMenu, edgeBar, barMenu, window, windowEvents, document } =
      await loadWidget({ width: 1024, height: 768 });
    bubble.emit("pointerdown", pointer(980, 720));
    vi.advanceTimersByTime(600);
    bubble.emit("pointerup", pointer(980, 720));
    bubbleMenu.children[1]!.emit("click");
    expect(edgeBar.style.width).toBe("16px");
    expect(edgeBar.style.left).toBe("1008px");
    expect(barMenu.style.right).toBe("16px");

    window.innerWidth = 390;
    document.documentElement.clientWidth = 390;
    windowEvents.get("resize")?.({} as Event);
    expect(edgeBar.style.width).toBe("8px");
    expect(edgeBar.style.left).toBe("382px");
    expect(barMenu.style.right).toBe("8px");
  });

  it("rounds the edge tab only after the drawer finishes closing", async () => {
    vi.useFakeTimers();
    const { bubble, bubbleMenu, edgeBar, documentEvents } = await loadWidget();
    const press = pointer(340, 790);
    bubble.emit("pointerdown", press);
    vi.advanceTimersByTime(600);
    bubble.emit("pointerup", press);
    bubbleMenu.children[0]!.emit("click");
    const toggleDrawer = () => {
      edgeBar.emit("pointerdown", pointer(4, 780));
      edgeBar.emit("pointerup", pointer(4, 780));
    };

    toggleDrawer();
    documentEvents.get("pointerdown")?.({ target: new FakeElement("main") } as unknown as Event);
    expect(edgeBar.style.borderRadius).toBe("0");
    toggleDrawer();
    vi.advanceTimersByTime(300);
    expect(edgeBar.style.borderRadius).toBe("0");

    toggleDrawer();
    vi.advanceTimersByTime(269);
    expect(edgeBar.style.borderRadius).toBe("0");
    vi.advanceTimersByTime(1);
    expect(edgeBar.style.borderRadius).toBe("0 8px 8px 0");
  });

  it("uses readable hide options and a bubble pointer in dark mode", async () => {
    vi.useFakeTimers();
    const { bubble, bubbleMenu, bubbleMenuPointer } = await loadWidget(undefined, {
      darkMode: true,
    });
    bubble.emit("pointerdown", pointer(340, 790));
    vi.advanceTimersByTime(600);
    bubble.emit("pointerup", pointer(340, 790));

    expect(bubbleMenu.style.background).toBe("#29313e");
    expect(bubbleMenu.children[0]!.style.color).toBe("#f7fafc");
    expect(bubbleMenuPointer.style.borderTop).toBe("8px solid #29313e");
    bubbleMenu.children[1]!.emit("mouseenter");
    expect(bubbleMenu.children[1]!.style.background).toBe("#3b4657");

    bubble.emit("pointerdown", pointer(340, 790));
    bubble.emit("pointermove", pointer(20, 20));
    bubble.emit("pointerup", pointer(20, 20));
    bubble.emit("pointerdown", pointer(20, 20));
    vi.advanceTimersByTime(600);
    expect(bubbleMenuPointer.style.borderBottom).toBe("8px solid #29313e");
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
