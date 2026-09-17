import {
  BUBBLE_SIZE,
  bubbleBounds,
  clampBubble,
  placeOpenWidget,
  snapBubble,
  type Point,
  type Viewport,
  type WidgetLayout,
} from "./layout";

(function initUsulAiWidget() {
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const baseUrl = currentScript ? new URL(currentScript.src).origin : "";
  const positionKey = "usul-ai-widget-position-v1";
  const fadeDelayMs = 5_000;
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const surface = prefersDark ? "rgba(20,30,45,0.72)" : "rgba(255,255,255,0.62)";
  const edge = prefersDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.78)";
  const ink = prefersDark ? "#7fb2e4" : "#3d6d9e";
  const shadow = prefersDark
    ? "0 20px 48px -22px rgba(0,0,0,0.78)"
    : "0 20px 48px -22px rgba(33,53,82,0.45)";

  const markSvg =
    '<svg viewBox="0 0 64 64" width="28" height="28" fill="currentColor" aria-hidden="true">' +
    '<g opacity="0.3"><rect x="15" y="15" width="34" height="34" rx="3"/>' +
    '<rect x="15" y="15" width="34" height="34" rx="3" transform="rotate(45 32 32)"/></g>' +
    '<g opacity="0.55"><rect x="22" y="22" width="20" height="20" rx="2.5"/>' +
    '<rect x="22" y="22" width="20" height="20" rx="2.5" transform="rotate(45 32 32)"/></g>' +
    '<rect x="27.5" y="27.5" width="9" height="9" rx="1.5" transform="rotate(45 32 32)"/></svg>';

  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Open Usul AI chat");
  bubble.setAttribute("aria-expanded", "false");
  bubble.innerHTML = markSvg;
  Object.assign(bubble.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${BUBBLE_SIZE}px`,
    height: `${BUBBLE_SIZE}px`,
    borderRadius: "50%",
    border: `1px solid ${edge}`,
    background: surface,
    backdropFilter: "blur(20px) saturate(165%)",
    WebkitBackdropFilter: "blur(20px) saturate(165%)",
    color: ink,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "1",
    cursor: "pointer",
    boxShadow: `${shadow}, inset 0 1px 0 ${edge}`,
    opacity: "0.5",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    transition: "left .28s ease, top .28s ease, opacity .2s ease, filter .2s ease",
    zIndex: "2147483647",
  });

  const frame = document.createElement("iframe");
  frame.src = `${baseUrl}/embed`;
  frame.title = "Usul AI";
  Object.assign(frame.style, {
    position: "fixed",
    left: "0",
    top: "0",
    border: "none",
    borderRadius: "24px",
    boxShadow: shadow,
    colorScheme: "light dark",
    display: "none",
    opacity: "0",
    transform: "translateY(12px) scale(0.98)",
    transformOrigin: "bottom right",
    transition: "opacity .24s ease, transform .24s ease",
    zIndex: "2147483646",
  });

  function viewport(): Viewport {
    return {
      width: document.documentElement.clientWidth || window.innerWidth,
      height: window.innerHeight,
    };
  }

  function readPosition(): Point | null {
    try {
      const stored = JSON.parse(localStorage.getItem(positionKey) ?? "null") as Point | null;
      if (
        stored &&
        Number.isFinite(stored.x) &&
        Number.isFinite(stored.y) &&
        stored.x >= 0 &&
        stored.x <= 1 &&
        stored.y >= 0 &&
        stored.y <= 1
      ) {
        return stored;
      }
    } catch {
      // The widget still works when storage is blocked.
    }
    return null;
  }

  const savedPosition = readPosition();
  const initialBounds = bubbleBounds(viewport());
  let ratios: Point = savedPosition ?? {
    x: initialBounds.x > 0 ? Math.max(0, initialBounds.x - 20) / initialBounds.x : 0,
    y: initialBounds.y > 0 ? Math.max(0, initialBounds.y - 20) / initialBounds.y : 0,
  };
  let restingPosition: Point = { x: 0, y: 0 };
  let bubblePosition: Point = { x: 0, y: 0 };
  let isOpen = false;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let activePointer:
    | {
        id: number;
        startX: number;
        startY: number;
        origin: Point;
        dragged: boolean;
      }
    | undefined;

  function setBubblePosition(next: Point) {
    bubblePosition = next;
    bubble.style.left = `${next.x}px`;
    bubble.style.top = `${next.y}px`;
  }

  function applyOpenLayout(layout: WidgetLayout) {
    Object.assign(frame.style, {
      left: `${layout.frame.x}px`,
      top: `${layout.frame.y}px`,
      width: `${layout.frame.width}px`,
      height: `${layout.frame.height}px`,
    });
    setBubblePosition(layout.bubble);
  }

  function setRestingPosition(next: Point, snap = false) {
    const size = viewport();
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    restingPosition = snap ? snapBubble(next, size, rem) : clampBubble(next, size);
    const bounds = bubbleBounds(size);
    ratios = {
      x: bounds.x > 0 ? restingPosition.x / bounds.x : 0,
      y: bounds.y > 0 ? restingPosition.y / bounds.y : 0,
    };
    if (!isOpen) setBubblePosition(restingPosition);
  }

  function rememberPosition() {
    try {
      localStorage.setItem(positionKey, JSON.stringify(ratios));
    } catch {
      // Storage may be unavailable on the host site.
    }
  }

  function showBubbleTemporarily() {
    clearTimeout(fadeTimer);
    bubble.style.opacity = "1";
    if (!isOpen) {
      fadeTimer = setTimeout(() => {
        bubble.style.opacity = "0.5";
      }, fadeDelayMs);
    }
  }

  function setOpen(open: boolean) {
    isOpen = open;
    bubble.setAttribute("aria-expanded", String(open));
    bubble.setAttribute("aria-label", open ? "Close Usul AI chat" : "Open Usul AI chat");
    showBubbleTemporarily();

    if (open) {
      clearTimeout(hideTimer);
      applyOpenLayout(placeOpenWidget(restingPosition, viewport()));
      frame.style.display = "block";
      requestAnimationFrame(() => {
        if (!isOpen) return;
        frame.style.opacity = "1";
        frame.style.transform = "none";
      });
      return;
    }

    setBubblePosition(restingPosition);
    frame.style.opacity = "0";
    frame.style.transform = "translateY(12px) scale(0.98)";
    hideTimer = setTimeout(() => {
      if (!isOpen) frame.style.display = "none";
    }, 240);
  }

  bubble.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    activePointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...bubblePosition },
      dragged: false,
    };
    bubble.setPointerCapture(event.pointerId);
    bubble.style.transition = "opacity .2s ease, filter .2s ease";
    showBubbleTemporarily();
  });

  bubble.addEventListener("pointermove", (event) => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    const dx = event.clientX - activePointer.startX;
    const dy = event.clientY - activePointer.startY;
    if (!activePointer.dragged && Math.hypot(dx, dy) < 6) return;
    activePointer.dragged = true;
    if (!isOpen) {
      setRestingPosition({ x: activePointer.origin.x + dx, y: activePointer.origin.y + dy }, true);
    }
    showBubbleTemporarily();
  });

  bubble.addEventListener("pointerup", (event) => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    const dragged = activePointer.dragged;
    activePointer = undefined;
    bubble.releasePointerCapture(event.pointerId);
    bubble.style.transition = "left .28s ease, top .28s ease, opacity .2s ease, filter .2s ease";
    if (dragged) {
      if (!isOpen) rememberPosition();
      showBubbleTemporarily();
    } else {
      setOpen(!isOpen);
    }
  });

  bubble.addEventListener("pointercancel", (event) => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    if (activePointer.dragged && !isOpen) rememberPosition();
    activePointer = undefined;
    bubble.style.transition = "left .28s ease, top .28s ease, opacity .2s ease, filter .2s ease";
    showBubbleTemporarily();
  });

  bubble.addEventListener("click", (event) => {
    if (event.detail === 0) setOpen(!isOpen);
  });

  bubble.addEventListener("mouseenter", () => {
    showBubbleTemporarily();
    bubble.style.filter = "brightness(1.08)";
  });

  bubble.addEventListener("mouseleave", () => {
    bubble.style.filter = "none";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) setOpen(false);
  });

  window.addEventListener("resize", () => {
    const bounds = bubbleBounds(viewport());
    setRestingPosition({ x: ratios.x * bounds.x, y: ratios.y * bounds.y });
    if (isOpen) applyOpenLayout(placeOpenWidget(restingPosition, viewport()));
  });

  setRestingPosition({ x: ratios.x * initialBounds.x, y: ratios.y * initialBounds.y });
  document.body.appendChild(frame);
  document.body.appendChild(bubble);
})();
