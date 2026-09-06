(function initUsulAiWidget() {
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const baseUrl = currentScript ? new URL(currentScript.src).origin : "";
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

  const closeSvg =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const bubble = document.createElement("button");
  bubble.setAttribute("aria-label", "Open Usul AI chat");
  bubble.setAttribute("aria-expanded", "false");
  bubble.innerHTML = markSvg;
  Object.assign(bubble.style, {
    position: "fixed",
    bottom: "max(20px, env(safe-area-inset-bottom))",
    right: "20px",
    width: "56px",
    height: "56px",
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
    transition: "transform .2s ease, filter .2s ease",
    zIndex: "2147483647",
  });

  const frame = document.createElement("iframe");
  frame.src = `${baseUrl}/embed`;
  frame.title = "Usul AI";
  Object.assign(frame.style, {
    position: "fixed",
    bottom: "max(88px, calc(env(safe-area-inset-bottom) + 76px))",
    right: "20px",
    width: "min(390px, calc(100vw - 40px))",
    height: "min(620px, calc(100dvh - 132px))",
    border: "none",
    borderRadius: "24px",
    boxShadow: shadow,
    colorScheme: "light dark",
    display: "none",
    opacity: "0",
    transform: "translateY(12px) scale(0.98)",
    transformOrigin: "bottom right",
    transition: "opacity .24s ease, transform .24s ease",
    zIndex: "2147483647",
  });

  function setOpen(open: boolean) {
    bubble.setAttribute("aria-expanded", String(open));
    bubble.setAttribute("aria-label", open ? "Close Usul AI chat" : "Open Usul AI chat");
    bubble.innerHTML = open ? closeSvg : markSvg;

    if (open) {
      frame.style.display = "block";
      requestAnimationFrame(() => {
        frame.style.opacity = "1";
        frame.style.transform = "none";
      });
      return;
    }

    frame.style.opacity = "0";
    frame.style.transform = "translateY(12px) scale(0.98)";
    setTimeout(() => {
      frame.style.display = "none";
    }, 240);
  }

  bubble.addEventListener("click", () => {
    setOpen(bubble.getAttribute("aria-expanded") !== "true");
  });

  bubble.addEventListener("mouseenter", () => {
    bubble.style.filter = "brightness(1.08)";
  });

  bubble.addEventListener("mouseleave", () => {
    bubble.style.filter = "none";
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bubble.getAttribute("aria-expanded") === "true") setOpen(false);
  });

  document.body.appendChild(frame);
  document.body.appendChild(bubble);
})();
