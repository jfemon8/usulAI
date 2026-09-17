import {
  bubbleBorderRadius,
  bubbleBounds,
  clampBubble,
  placeOpenWidget,
  snapBubble,
  type Point,
  type Viewport,
  type WidgetLayout,
} from "./layout";
import {
  WIDGET_CHAT_KEY,
  WIDGET_MESSAGE_SOURCE,
  WIDGET_NAVIGATION_KEY,
  WIDGET_VISIT_KEY,
  isWidgetChat,
  isWidgetMessage,
  shouldContinueVisit,
  type WidgetChat,
  type WidgetMessage,
} from "./session";

(function initUsulAiWidget() {
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const baseUrl = currentScript ? new URL(currentScript.src).origin : "";
  const positionKey = "usul-ai-widget-position-v1";
  const hiddenKey = "usul-ai-widget-hidden-v1";
  const fadeDelayMs = 5_000;
  const holdDelayMs = 600;
  const drawerTransitionMs = 220;
  const barHeight = 56;
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const surface = "#d6dbe3";
  const edge = "#a3adbc";
  const panelSurface = prefersDark ? "#1b1d21" : "#ffffff";
  const menuSurface = prefersDark ? "#29313e" : "#f8fafc";
  const menuEdge = prefersDark ? "#526071" : "#c8d1dd";
  const menuHover = prefersDark ? "#3b4657" : "#e7edf5";
  const drawerSurface = "#513477";
  const drawerHover = "#6a4b91";
  const shadow = prefersDark
    ? "0 20px 48px -22px rgba(0,0,0,0.78)"
    : "0 20px 48px -22px rgba(33,53,82,0.45)";

  const markSvg =
    '<svg viewBox="0 0 64 64" style="width:calc(100% - 4px);height:calc(100% - 4px)" aria-hidden="true">' +
    '<defs><linearGradient id="usulWidgetLogoFill" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#315f8d"/><stop offset="1" stop-color="#193d62"/>' +
    '</linearGradient></defs><g fill="url(#usulWidgetLogoFill)">' +
    '<g opacity="0.3"><rect x="15" y="15" width="34" height="34" rx="3"/>' +
    '<rect x="15" y="15" width="34" height="34" rx="3" transform="rotate(45 32 32)"/></g>' +
    '<g opacity="0.55"><rect x="22" y="22" width="20" height="20" rx="2.5"/>' +
    '<rect x="22" y="22" width="20" height="20" rx="2.5" transform="rotate(45 32 32)"/></g>' +
    '<rect x="27.5" y="27.5" width="9" height="9" rx="1.5" transform="rotate(45 32 32)"/></g></svg>';

  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Open Usul AI chat");
  bubble.setAttribute("aria-expanded", "false");
  bubble.innerHTML = markSvg;
  Object.assign(bubble.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "3rem",
    height: "3rem",
    borderRadius: "50%",
    padding: "0",
    margin: "0",
    boxSizing: "border-box",
    border: `1px solid ${edge}`,
    background: surface,
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

  const bubbleMenu = document.createElement("div");
  bubbleMenu.setAttribute("role", "menu");
  bubbleMenu.setAttribute("aria-label", "Hide Usul AI chat bubble");
  Object.assign(bubbleMenu.style, {
    position: "fixed",
    display: "none",
    flexDirection: "column",
    gap: "2px",
    width: "128px",
    height: "96px",
    padding: "4px",
    boxSizing: "border-box",
    justifyContent: "center",
    border: `1px solid ${menuEdge}`,
    borderRadius: "12px",
    background: menuSurface,
    boxShadow: shadow,
    zIndex: "2147483647",
  });

  const bubbleMenuPointer = document.createElement("div");
  bubbleMenuPointer.setAttribute("aria-hidden", "true");
  Object.assign(bubbleMenuPointer.style, {
    position: "fixed",
    display: "none",
    width: "0",
    height: "0",
    pointerEvents: "none",
    zIndex: "2147483647",
  });

  function menuButton(label: string, drawer = false): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("role", "menuitem");
    Object.assign(button.style, {
      display: "block",
      width: "100%",
      padding: "10px 12px",
      boxSizing: "border-box",
      border: "0",
      borderRadius: "8px",
      background: "transparent",
      color: drawer ? "#ffffff" : prefersDark ? "#f7fafc" : "#243044",
      font: "500 14px system-ui, sans-serif",
      textAlign: "left",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    button.addEventListener("mouseenter", () => {
      button.style.background = drawer ? drawerHover : menuHover;
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = "transparent";
    });
    button.addEventListener("focus", () => {
      button.style.background = drawer ? drawerHover : menuHover;
    });
    button.addEventListener("blur", () => {
      button.style.background = "transparent";
    });
    return button;
  }

  const hideLeft = menuButton("Hide Left");
  const hideRight = menuButton("Hide Right");
  bubbleMenu.append(hideLeft, hideRight);

  const edgeBar = document.createElement("button");
  edgeBar.type = "button";
  edgeBar.setAttribute("aria-label", "Usul AI hidden chat tab");
  edgeBar.setAttribute("aria-expanded", "false");
  edgeBar.setAttribute("aria-haspopup", "menu");
  Object.assign(edgeBar.style, {
    position: "fixed",
    display: "none",
    width: edgeBarWidth().css,
    height: `${barHeight}px`,
    padding: "0",
    margin: "0",
    boxSizing: "border-box",
    border: "0",
    background: drawerSurface,
    boxShadow: shadow,
    opacity: "0.75",
    cursor: "pointer",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    transition: "top .2s ease, opacity .2s ease",
    zIndex: "2147483647",
  });

  const barMenu = document.createElement("div");
  barMenu.setAttribute("role", "menu");
  barMenu.setAttribute("aria-label", "Usul AI hidden chat actions");
  barMenu.setAttribute("aria-hidden", "true");
  Object.assign(barMenu.style, {
    position: "fixed",
    display: "flex",
    alignItems: "center",
    width: "0px",
    height: `${barHeight}px`,
    padding: "0",
    boxSizing: "border-box",
    overflow: "hidden",
    background: drawerSurface,
    boxShadow: "none",
    pointerEvents: "none",
    transition: `width ${drawerTransitionMs}ms ease`,
    zIndex: "2147483647",
  });
  const showUsulAi = menuButton("Show UsulAI", true);
  showUsulAi.tabIndex = -1;
  barMenu.append(showUsulAi);

  function readStored(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStored(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      // Chat remains usable when host session storage is unavailable.
    }
  }

  function createVisitId(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    );
  }

  const navigation = (() => {
    try {
      return JSON.parse(readStored(WIDGET_NAVIGATION_KEY) ?? "null") as {
        href: string;
        at: number;
      } | null;
    } catch {
      return null;
    }
  })();
  writeStored(WIDGET_NAVIGATION_KEY, null);
  const expectedUrl = navigation && Date.now() - navigation.at < 30_000 ? navigation.href : null;
  const navigationType = window.performance?.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  const previousVisit = readStored(WIDGET_VISIT_KEY);
  let visitId =
    previousVisit &&
    shouldContinueVisit(
      document.referrer ?? "",
      window.location.href,
      navigationType?.type ?? "navigate",
      expectedUrl,
    )
      ? previousVisit
      : createVisitId();
  if (visitId !== previousVisit) writeStored(WIDGET_CHAT_KEY, null);
  writeStored(WIDGET_VISIT_KEY, visitId);

  function readChat(): WidgetChat | null {
    try {
      const stored: unknown = JSON.parse(readStored(WIDGET_CHAT_KEY) ?? "null");
      return isWidgetChat(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  let chatState = readChat();
  let leavingSite = false;
  let departed = false;

  const frame = document.createElement("iframe");
  const embedUrl = new URL("/embed", baseUrl);
  embedUrl.searchParams.set("widgetOrigin", window.location.origin);
  embedUrl.searchParams.set("widgetVisit", visitId);
  frame.src = embedUrl.href;
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

  const headPointer = document.createElement("div");
  headPointer.setAttribute("aria-hidden", "true");
  Object.assign(headPointer.style, {
    position: "fixed",
    width: "0",
    height: "0",
    display: "none",
    opacity: "0",
    pointerEvents: "none",
    transition: "opacity .24s ease",
    zIndex: "2147483646",
  });

  function viewport(): Viewport {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return {
      width: document.documentElement.clientWidth || window.innerWidth,
      height: window.innerHeight,
      bubbleSize: rem * 3,
    };
  }

  function edgeBarWidth(): { css: string; px: number } {
    const size = viewport();
    const remWidth = size.width <= 640 ? 0.5 : 0.75;
    return { css: `${remWidth}rem`, px: (size.bubbleSize! / 3) * remWidth };
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

  function readHidden(): { side: "left" | "right"; y: number } | null {
    try {
      const stored = JSON.parse(localStorage.getItem(hiddenKey) ?? "null") as {
        side?: unknown;
        y?: unknown;
      } | null;
      if (
        (stored?.side === "left" || stored?.side === "right") &&
        typeof stored.y === "number" &&
        Number.isFinite(stored.y) &&
        stored.y >= 0 &&
        stored.y <= 1
      ) {
        return { side: stored.side, y: stored.y };
      }
    } catch {
      // The widget remains usable when storage is unavailable.
    }
    return null;
  }

  const savedPosition = readPosition();
  const savedHidden = readHidden();
  const initialBounds = bubbleBounds(viewport());
  let ratios: Point = savedPosition ?? {
    x: initialBounds.x > 0 ? Math.max(0, initialBounds.x - 20) / initialBounds.x : 0,
    y: initialBounds.y > 0 ? Math.max(0, initialBounds.y - 20) / initialBounds.y : 0,
  };
  let restingPosition: Point = { x: 0, y: 0 };
  let bubblePosition: Point = { x: 0, y: 0 };
  let isOpen = false;
  let hiddenSide: "left" | "right" | null = savedHidden?.side ?? null;
  let barRatio = savedHidden?.y ?? ratios.y;
  let barY = 0;
  let bubbleMenuOpen = false;
  let barMenuOpen = false;
  let barClosing = false;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let barFadeTimer: ReturnType<typeof setTimeout> | undefined;
  let barCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let activePointer:
    | {
        id: number;
        startX: number;
        startY: number;
        origin: Point;
        dragged: boolean;
        held: boolean;
      }
    | undefined;
  let activeBarPointer:
    { id: number; startY: number; originY: number; dragged: boolean } | undefined;

  function setBubblePosition(next: Point) {
    bubblePosition = next;
    bubble.style.left = `${next.x}px`;
    bubble.style.top = `${next.y}px`;
    bubble.style.borderRadius = isOpen ? "50%" : bubbleBorderRadius(next, viewport());
  }

  function applyOpenLayout(layout: WidgetLayout) {
    Object.assign(frame.style, {
      left: `${layout.frame.x}px`,
      top: `${layout.frame.y}px`,
      width: `${layout.frame.width}px`,
      height: `${layout.frame.height}px`,
    });
    const arrowInset = viewport().bubbleSize! / 2 - 9;
    const arrowLeft = layout.pointer === "top" ? layout.bubble.x + arrowInset : layout.frame.x - 10;
    const arrowTop = layout.pointer === "top" ? layout.frame.y - 10 : layout.bubble.y + arrowInset;
    Object.assign(headPointer.style, {
      left: `${arrowLeft}px`,
      top: `${arrowTop}px`,
      borderTop: layout.pointer === "left" ? "9px solid transparent" : "0",
      borderRight:
        layout.pointer === "top" ? "9px solid transparent" : `10px solid ${panelSurface}`,
      borderBottom:
        layout.pointer === "top" ? `10px solid ${panelSurface}` : "9px solid transparent",
      borderLeft: layout.pointer === "top" ? "9px solid transparent" : "0",
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

  function rememberHidden() {
    try {
      if (hiddenSide)
        localStorage.setItem(hiddenKey, JSON.stringify({ side: hiddenSide, y: barRatio }));
      else localStorage.removeItem(hiddenKey);
    } catch {
      // Storage may be unavailable on the host site.
    }
  }

  function placeBubbleMenu() {
    const size = viewport();
    const menuWidth = 128;
    const menuHeight = 96;
    const below = bubblePosition.y + size.bubbleSize! + 8 + menuHeight <= size.height;
    const left = Math.max(0, Math.min(bubblePosition.x, size.width - menuWidth));
    const top = Math.max(
      0,
      Math.min(
        below ? bubblePosition.y + size.bubbleSize! + 8 : bubblePosition.y - menuHeight - 8,
        size.height - menuHeight,
      ),
    );
    bubbleMenu.style.left = `${left}px`;
    bubbleMenu.style.top = `${top}px`;
    bubbleMenuPointer.style.left = `${Math.max(
      left + 12,
      Math.min(bubblePosition.x + size.bubbleSize! / 2 - 8, left + menuWidth - 28),
    )}px`;
    bubbleMenuPointer.style.top = `${below ? top - 8 : top + menuHeight}px`;
    bubbleMenuPointer.style.borderLeft = "8px solid transparent";
    bubbleMenuPointer.style.borderRight = "8px solid transparent";
    bubbleMenuPointer.style.borderTop = below ? "0" : `8px solid ${menuSurface}`;
    bubbleMenuPointer.style.borderBottom = below ? `8px solid ${menuSurface}` : "0";
  }

  function setBubbleMenuOpen(open: boolean) {
    bubbleMenuOpen = open;
    bubbleMenu.style.display = open ? "flex" : "none";
    bubbleMenuPointer.style.display = open ? "block" : "none";
    if (!open) {
      hideLeft.style.background = "transparent";
      hideRight.style.background = "transparent";
    }
    bubble.setAttribute("aria-haspopup", "menu");
    if (open) placeBubbleMenu();
    showBubbleTemporarily();
  }

  function placeBarMenu() {
    const width = edgeBarWidth();
    barMenu.style.left = hiddenSide === "left" ? width.css : "auto";
    barMenu.style.right = hiddenSide === "right" ? width.css : "auto";
    barMenu.style.top = `${barY}px`;
    barMenu.style.borderRadius = hiddenSide === "left" ? "0 8px 8px 0" : "8px 0 0 8px";
    barMenu.style.width = `${barMenuOpen ? Math.min(132, viewport().width - width.px) : 0}px`;
  }

  function finishBarClose() {
    if (!barClosing || barMenuOpen) return;
    clearTimeout(barCloseTimer);
    barClosing = false;
    edgeBar.style.borderRadius = hiddenSide === "left" ? "0 8px 8px 0" : "8px 0 0 8px";
    edgeBar.style.boxShadow = shadow;
    barMenu.style.boxShadow = "none";
  }

  function setBarMenuOpen(open: boolean) {
    const wasOpen = barMenuOpen;
    clearTimeout(barCloseTimer);
    barMenuOpen = open;
    barClosing = !open && wasOpen;
    barMenu.style.display = "flex";
    barMenu.style.pointerEvents = open ? "auto" : "none";
    barMenu.style.boxShadow = open || barClosing ? shadow : "none";
    barMenu.setAttribute("aria-hidden", String(!open));
    showUsulAi.tabIndex = open ? 0 : -1;
    if (!open) showUsulAi.style.background = "transparent";
    edgeBar.setAttribute("aria-expanded", String(open));
    edgeBar.style.borderRadius =
      open || barClosing ? "0" : hiddenSide === "left" ? "0 8px 8px 0" : "8px 0 0 8px";
    edgeBar.style.boxShadow = open || barClosing ? "none" : shadow;
    placeBarMenu();
    if (barClosing) barCloseTimer = setTimeout(finishBarClose, drawerTransitionMs + 50);
    showBarTemporarily();
  }

  function setBarPosition(nextY: number) {
    const maxY = Math.max(0, viewport().height - barHeight);
    const width = edgeBarWidth();
    barY = Math.max(0, Math.min(nextY, maxY));
    barRatio = maxY > 0 ? barY / maxY : 0;
    edgeBar.style.width = width.css;
    edgeBar.style.left =
      hiddenSide === "left" ? "0px" : `${Math.max(0, viewport().width - width.px)}px`;
    edgeBar.style.top = `${barY}px`;
    edgeBar.style.borderRadius =
      barMenuOpen || barClosing ? "0" : hiddenSide === "left" ? "0 8px 8px 0" : "8px 0 0 8px";
    placeBarMenu();
  }

  function showBarTemporarily() {
    clearTimeout(barFadeTimer);
    edgeBar.style.opacity = "1";
    if (!barMenuOpen && !activeBarPointer) {
      barFadeTimer = setTimeout(() => {
        edgeBar.style.opacity = "0.75";
      }, fadeDelayMs);
    }
  }

  function hideBubble(side: "left" | "right") {
    if (isOpen) return;
    setBubbleMenuOpen(false);
    hiddenSide = side;
    setBarPosition(restingPosition.y + (viewport().bubbleSize! - barHeight) / 2);
    bubble.style.display = "none";
    edgeBar.style.display = "block";
    barMenu.style.display = "flex";
    rememberHidden();
    showBarTemporarily();
  }

  function restoreBubble() {
    if (!hiddenSide) return;
    const bounds = bubbleBounds(viewport());
    const x = hiddenSide === "left" ? 0 : bounds.x;
    setRestingPosition({ x, y: barY + (barHeight - viewport().bubbleSize!) / 2 });
    rememberPosition();
    hiddenSide = null;
    rememberHidden();
    setBarMenuOpen(false);
    edgeBar.style.display = "none";
    barMenu.style.display = "none";
    clearTimeout(barCloseTimer);
    barClosing = false;
    bubble.style.display = "flex";
    showBubbleTemporarily();
  }

  function showBubbleTemporarily() {
    clearTimeout(fadeTimer);
    bubble.style.opacity = "1";
    if (!isOpen && !bubbleMenuOpen) {
      fadeTimer = setTimeout(() => {
        bubble.style.opacity = "0.5";
      }, fadeDelayMs);
    }
  }

  function setOpen(open: boolean) {
    if (open && bubbleMenuOpen) setBubbleMenuOpen(false);
    isOpen = open;
    bubble.setAttribute("aria-expanded", String(open));
    bubble.setAttribute("aria-label", open ? "Close Usul AI chat" : "Open Usul AI chat");
    showBubbleTemporarily();

    if (open) {
      clearTimeout(hideTimer);
      applyOpenLayout(placeOpenWidget(restingPosition, viewport()));
      frame.style.display = "block";
      headPointer.style.display = "block";
      requestAnimationFrame(() => {
        if (!isOpen) return;
        frame.style.opacity = "1";
        frame.style.transform = "none";
        headPointer.style.opacity = "1";
      });
      return;
    }

    setBubblePosition(restingPosition);
    frame.style.opacity = "0";
    headPointer.style.opacity = "0";
    frame.style.transform = "translateY(12px) scale(0.98)";
    hideTimer = setTimeout(() => {
      if (!isOpen) {
        frame.style.display = "none";
        headPointer.style.display = "none";
      }
    }, 240);
  }

  bubble.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    clearTimeout(holdTimer);
    activePointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...bubblePosition },
      dragged: false,
      held: false,
    };
    bubble.setPointerCapture(event.pointerId);
    bubble.style.transition = "opacity .2s ease, filter .2s ease";
    showBubbleTemporarily();
    if (!isOpen && !bubbleMenuOpen) {
      holdTimer = setTimeout(() => {
        if (!activePointer || activePointer.id !== event.pointerId || activePointer.dragged) return;
        activePointer.held = true;
        setBubbleMenuOpen(true);
      }, holdDelayMs);
    }
  });

  bubble.addEventListener("pointermove", (event) => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    const dx = event.clientX - activePointer.startX;
    const dy = event.clientY - activePointer.startY;
    if (!activePointer.dragged && Math.hypot(dx, dy) < 6) return;
    clearTimeout(holdTimer);
    activePointer.dragged = true;
    if (!isOpen) {
      if (bubbleMenuOpen) setBubbleMenuOpen(false);
      setRestingPosition({ x: activePointer.origin.x + dx, y: activePointer.origin.y + dy }, true);
    }
    showBubbleTemporarily();
  });

  bubble.addEventListener("pointerup", (event) => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    const dragged = activePointer.dragged;
    const held = activePointer.held;
    clearTimeout(holdTimer);
    activePointer = undefined;
    bubble.releasePointerCapture(event.pointerId);
    bubble.style.transition = "left .28s ease, top .28s ease, opacity .2s ease, filter .2s ease";
    if (dragged) {
      if (!isOpen) rememberPosition();
      showBubbleTemporarily();
    } else if (held) {
      showBubbleTemporarily();
    } else if (bubbleMenuOpen) {
      setBubbleMenuOpen(false);
    } else {
      setOpen(!isOpen);
    }
  });

  bubble.addEventListener("pointercancel", (event) => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    clearTimeout(holdTimer);
    if (activePointer.dragged && !isOpen) rememberPosition();
    activePointer = undefined;
    bubble.style.transition = "left .28s ease, top .28s ease, opacity .2s ease, filter .2s ease";
    showBubbleTemporarily();
  });

  bubble.addEventListener("click", (event) => {
    if (event.detail === 0) {
      if (bubbleMenuOpen) setBubbleMenuOpen(false);
      else setOpen(!isOpen);
    }
  });

  bubble.addEventListener("contextmenu", (event) => {
    if (isOpen) return;
    event.preventDefault();
    clearTimeout(holdTimer);
    if (activePointer) activePointer.held = true;
    setBubbleMenuOpen(true);
  });

  hideLeft.addEventListener("click", () => hideBubble("left"));
  hideRight.addEventListener("click", () => hideBubble("right"));

  edgeBar.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    activeBarPointer = {
      id: event.pointerId,
      startY: event.clientY,
      originY: barY,
      dragged: false,
    };
    edgeBar.setPointerCapture(event.pointerId);
    edgeBar.style.transition = "opacity .2s ease";
    showBarTemporarily();
  });

  edgeBar.addEventListener("pointermove", (event) => {
    if (!activeBarPointer || event.pointerId !== activeBarPointer.id) return;
    const dy = event.clientY - activeBarPointer.startY;
    if (!activeBarPointer.dragged && Math.abs(dy) < 6) return;
    activeBarPointer.dragged = true;
    if (barMenuOpen) setBarMenuOpen(false);
    setBarPosition(activeBarPointer.originY + dy);
    showBarTemporarily();
  });

  edgeBar.addEventListener("pointerup", (event) => {
    if (!activeBarPointer || event.pointerId !== activeBarPointer.id) return;
    const dragged = activeBarPointer.dragged;
    activeBarPointer = undefined;
    edgeBar.releasePointerCapture(event.pointerId);
    edgeBar.style.transition = "top .2s ease, opacity .2s ease";
    if (dragged) rememberHidden();
    else setBarMenuOpen(!barMenuOpen);
    showBarTemporarily();
  });

  edgeBar.addEventListener("pointercancel", (event) => {
    if (!activeBarPointer || event.pointerId !== activeBarPointer.id) return;
    if (activeBarPointer.dragged) rememberHidden();
    activeBarPointer = undefined;
    edgeBar.style.transition = "top .2s ease, opacity .2s ease";
    showBarTemporarily();
  });

  edgeBar.addEventListener("click", (event) => {
    if (event.detail === 0) setBarMenuOpen(!barMenuOpen);
  });

  edgeBar.addEventListener("mouseenter", showBarTemporarily);
  showUsulAi.addEventListener("click", restoreBubble);
  barMenu.addEventListener("transitionend", (event) => {
    if (event.target === barMenu && event.propertyName === "width") finishBarClose();
  });

  bubble.addEventListener("mouseenter", () => {
    showBubbleTemporarily();
    bubble.style.filter = "brightness(1.08)";
  });

  bubble.addEventListener("mouseleave", () => {
    bubble.style.filter = "none";
  });

  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Node)) return;
    if (bubbleMenuOpen && !bubble.contains(event.target) && !bubbleMenu.contains(event.target)) {
      setBubbleMenuOpen(false);
    }
    if (barMenuOpen && !edgeBar.contains(event.target) && !barMenu.contains(event.target)) {
      setBarMenuOpen(false);
    }
    if (isOpen && !bubble.contains(event.target) && !frame.contains(event.target)) {
      setOpen(false);
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("target") === "_blank"
      ) {
        return;
      }
      try {
        const destination = new URL((anchor as HTMLAnchorElement).href, window.location.href);
        if (destination.origin !== window.location.origin) {
          leavingSite = true;
        } else if (destination.href !== window.location.href) {
          leavingSite = false;
          writeStored(
            WIDGET_NAVIGATION_KEY,
            JSON.stringify({ href: destination.href, at: Date.now() }),
          );
        }
      } catch {
        // Ignore invalid links.
      }
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.tagName !== "FORM" || form.target === "_blank") return;
      try {
        const destination = new URL(form.action || window.location.href, window.location.href);
        if (destination.origin !== window.location.origin) {
          leavingSite = true;
        } else {
          leavingSite = false;
          writeStored(
            WIDGET_NAVIGATION_KEY,
            JSON.stringify({ href: destination.href, at: Date.now() }),
          );
        }
      } catch {
        // Ignore invalid form destinations.
      }
    },
    true,
  );

  window.addEventListener("pagehide", () => {
    if (!leavingSite) return;
    departed = true;
    writeStored(WIDGET_VISIT_KEY, null);
    writeStored(WIDGET_CHAT_KEY, null);
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    departed = false;
    const storedVisit = readStored(WIDGET_VISIT_KEY);
    if (storedVisit === visitId) return;
    visitId = storedVisit ?? createVisitId();
    chatState = readChat();
    writeStored(WIDGET_VISIT_KEY, visitId);
    embedUrl.searchParams.set("widgetVisit", visitId);
    frame.src = embedUrl.href;
    if (isOpen) setOpen(false);
    leavingSite = false;
  });

  window.addEventListener("message", (event) => {
    if (
      event.origin !== baseUrl ||
      event.source !== frame.contentWindow ||
      !isWidgetMessage(event.data) ||
      event.data.visitId !== visitId
    ) {
      return;
    }
    if (event.data.type === "ready") {
      const response: WidgetMessage = {
        source: WIDGET_MESSAGE_SOURCE,
        type: "restore",
        visitId,
        chat: chatState,
      };
      frame.contentWindow?.postMessage(response, baseUrl);
    } else if (event.data.type === "save") {
      if (departed) return;
      const pendingJobId =
        event.data.chat.messages.at(-1)?.role === "assistant" ||
        chatState?.id !== event.data.chat.id
          ? undefined
          : chatState.pendingJobId;
      chatState = {
        ...event.data.chat,
        ...(pendingJobId ? { pendingJobId } : {}),
      };
      writeStored(WIDGET_CHAT_KEY, JSON.stringify(chatState));
    } else if (event.data.type === "pending") {
      if (departed) return;
      chatState = {
        id: event.data.chatId,
        messages: event.data.messages,
        pendingJobId: event.data.jobId,
      };
      writeStored(WIDGET_CHAT_KEY, JSON.stringify(chatState));
    } else if (event.data.type === "cancel") {
      if (chatState?.id !== event.data.chatId || chatState.pendingJobId !== event.data.jobId) {
        return;
      }
      chatState = { id: chatState.id, messages: chatState.messages };
      writeStored(WIDGET_CHAT_KEY, JSON.stringify(chatState));
    } else if (event.data.type === "clear") {
      chatState = null;
      writeStored(WIDGET_CHAT_KEY, null);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (bubbleMenuOpen) setBubbleMenuOpen(false);
    else if (barMenuOpen) setBarMenuOpen(false);
    else if (isOpen) setOpen(false);
  });

  window.addEventListener("resize", () => {
    const bounds = bubbleBounds(viewport());
    setRestingPosition({ x: ratios.x * bounds.x, y: ratios.y * bounds.y }, true);
    if (isOpen) applyOpenLayout(placeOpenWidget(restingPosition, viewport()));
    if (bubbleMenuOpen) placeBubbleMenu();
    if (hiddenSide) setBarPosition(barRatio * Math.max(0, viewport().height - barHeight));
  });

  setRestingPosition({ x: ratios.x * initialBounds.x, y: ratios.y * initialBounds.y }, true);
  if (hiddenSide) {
    setBarPosition(barRatio * Math.max(0, viewport().height - barHeight));
    bubble.style.display = "none";
    edgeBar.style.display = "block";
  }
  document.body.appendChild(frame);
  document.body.appendChild(headPointer);
  document.body.appendChild(bubble);
  document.body.appendChild(bubbleMenu);
  document.body.appendChild(bubbleMenuPointer);
  document.body.appendChild(edgeBar);
  document.body.appendChild(barMenu);
})();
