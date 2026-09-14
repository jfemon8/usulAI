"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  TransformComponent,
  TransformWrapper,
  useTransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FitPageIcon,
  HighlighterIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/ui/Icons";
import { SOURCE_VIEW_CONFIG } from "@/config/site";
import {
  downloadRenderedSource,
  holdRenderedSource,
  loadRenderedSource,
  peekRenderedSource,
  prefetchRenderedSource,
  type PdfDelivery,
  type RenderedSource,
} from "@/lib/sourceView/clientPdf";
import type { AnswerSource } from "@/types";

interface SourceViewerProps {
  sources: AnswerSource[];
  startIndex: number;
  onClose: () => void;
}

interface LoadResult {
  key: string;
  rendered?: RenderedSource;
  error?: string;
}

const DELIVERY_LABELS: Record<PdfDelivery | "idle", string> = {
  idle: "PDF ডাউনলোড করুন",
  downloaded: "PDF ডাউনলোড শুরু হয়েছে",
  opened: "ডাউনলোড করা যায়নি, তাই PDF নতুন ট্যাবে খোলা হয়েছে",
  failed: "PDF ডাউনলোড বা খোলা যায়নি, আবার চেষ্টা করুন",
};

const SOURCE_LABELS: Record<AnswerSource["sourceType"], string> = {
  quran: "কুরআন",
  hadith: "হাদিস",
  ijma: "ইজমা",
  qiyas: "কিয়াস",
  sirat: "সীরাত ও জীবনী",
  fiqh: "ফিকহ ও ফতোয়া",
};

const ICON_BUTTON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-(--text-2) transition hover:bg-(--surface-3) hover:text-(--text-1) active:scale-95 disabled:pointer-events-none disabled:opacity-35 [&_svg]:h-[18px] [&_svg]:w-[18px]";

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={ICON_BUTTON}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function ZoomLevel({ onReset }: { onReset: () => void }) {
  const percent = useTransformComponent(({ state }) => Math.round(state.scale * 100));
  return (
    <button
      type="button"
      onClick={onReset}
      className="hidden h-9 min-w-14 items-center justify-center rounded-lg px-2 text-xs font-medium text-(--text-2) tabular-nums transition hover:bg-(--surface-3) hover:text-(--text-1) sm:inline-flex"
      aria-label={`জুম ${percent}%, ১০০% এ ফিরুন`}
      title="১০০% এ ফিরুন"
    >
      {percent}%
    </button>
  );
}

function clampAxis(position: number, viewport: number, size: number): number {
  if (size <= viewport) return (viewport - size) / 2;
  return Math.min(0, Math.max(viewport - size, position));
}

export function SourceViewer({ sources, startIndex, onClose }: SourceViewerProps) {
  const [position, setPosition] = useState(startIndex);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [delivery, setDelivery] = useState<{ key: string; state: PdfDelivery } | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const pressedOverlay = useRef(false);
  const source = sources[position];
  const reference = source?.reference ?? "";
  const loadKey = `${reference}#${attempt}`;
  const cached = reference ? peekRenderedSource(reference) : undefined;
  const rendered = cached ?? (result?.key === loadKey ? result.rendered : undefined);
  const error = !rendered && result?.key === loadKey ? result.error : undefined;

  const go = useCallback(
    (delta: number) => {
      setPosition((current) => Math.min(sources.length - 1, Math.max(0, current + delta)));
    },
    [sources.length],
  );

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    const transform = transformRef.current;
    const wrapper = transform?.instance.wrapperComponent;
    const content = transform?.instance.contentComponent;
    if (!transform || !wrapper || !content) return;
    const { scale, positionX, positionY } = transform.state;
    transform.setTransform(
      clampAxis(positionX - deltaX, wrapper.clientWidth, content.offsetWidth * scale),
      clampAxis(positionY - deltaY, wrapper.clientHeight, content.offsetHeight * scale),
      scale,
      0,
    );
  }, []);

  const fitPage = useCallback(() => {
    const transform = transformRef.current;
    const wrapper = transform?.instance.wrapperComponent;
    const content = transform?.instance.contentComponent;
    if (!transform || !wrapper || !content) return;
    const { scale, positionY } = transform.state;
    const centre = (wrapper.clientHeight / 2 - positionY) / scale;
    transform.setTransform(
      clampAxis(0, wrapper.clientWidth, content.offsetWidth),
      clampAxis(wrapper.clientHeight / 2 - centre, wrapper.clientHeight, content.offsetHeight),
      1,
      220,
    );
  }, []);

  const focusHighlight = useCallback((animate: boolean) => {
    const transform = transformRef.current;
    const marker = markerRef.current;
    const wrapper = transform?.instance.wrapperComponent;
    const content = transform?.instance.contentComponent;
    if (!transform || !wrapper || !content) return;
    const scale = transform.state.scale;
    const offset = marker
      ? (marker.getBoundingClientRect().top - content.getBoundingClientRect().top) / scale
      : 0;
    const target = offset < wrapper.clientHeight * 0.55 ? 0 : offset - 16;
    transform.setTransform(
      clampAxis(0, wrapper.clientWidth, content.offsetWidth),
      clampAxis(-target, wrapper.clientHeight, content.offsetHeight),
      1,
      animate ? 220 : 0,
    );
  }, []);

  useEffect(() => {
    if (!reference) return;
    return holdRenderedSource(reference);
  }, [reference]);

  useEffect(() => {
    if (!delivery) return;
    const timer = setTimeout(() => setDelivery(null), SOURCE_VIEW_CONFIG.downloadFeedbackMs);
    return () => clearTimeout(timer);
  }, [delivery]);

  useEffect(() => {
    if (!reference || peekRenderedSource(reference)) return;
    let active = true;
    loadRenderedSource(reference)
      .then((value) => {
        if (active) setResult({ key: loadKey, rendered: value });
      })
      .catch((reason: unknown) => {
        if (active) {
          setResult({
            key: loadKey,
            error: reason instanceof Error ? reason.message : "সূত্রটি এখন দেখানো যাচ্ছে না।",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [reference, loadKey]);

  useEffect(() => {
    if (!rendered) return;
    const neighbours = [sources[position + 1], sources[position - 1]].filter(
      (item): item is AnswerSource => Boolean(item),
    );
    const timer = setTimeout(() => {
      neighbours.forEach((item) => prefetchRenderedSource(item.reference));
    }, 150);
    return () => clearTimeout(timer);
  }, [rendered, position, sources]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const transform = transformRef.current;
    const wrapper = transform?.instance.wrapperComponent;
    const content = transform?.instance.contentComponent;
    if (!transform || !wrapper || !content) return;
    const { scale, positionX, positionY } = transform.state;
    const next = Math.min(
      SOURCE_VIEW_CONFIG.maxScale,
      Math.max(SOURCE_VIEW_CONFIG.minScale, scale * factor),
    );
    if (next === scale) return;
    const bounds = wrapper.getBoundingClientRect();
    const pointX = clientX - bounds.left;
    const pointY = clientY - bounds.top;
    const ratio = next / scale;
    transform.setTransform(
      clampAxis(
        pointX - (pointX - positionX) * ratio,
        wrapper.clientWidth,
        content.offsetWidth * next,
      ),
      clampAxis(
        pointY - (pointY - positionY) * ratio,
        wrapper.clientHeight,
        content.offsetHeight * next,
      ),
      next,
      0,
    );
  }, []);

  const zoomCentre = useCallback(
    (factor: number) => {
      const wrapper = transformRef.current?.instance.wrapperComponent;
      if (!wrapper) return;
      const bounds = wrapper.getBoundingClientRect();
      zoomAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, factor);
    },
    [zoomAt],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onWheel = (event: WheelEvent) => {
      const viewport = viewportRef.current;
      if (!viewport || !(event.target instanceof Node) || !viewport.contains(event.target)) return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? SOURCE_VIEW_CONFIG.wheelLineHeight
          : event.deltaMode === 2
            ? viewport.clientHeight
            : 1;

      if (event.ctrlKey || event.metaKey) {
        zoomAt(
          event.clientX,
          event.clientY,
          Math.exp(-event.deltaY * unit * SOURCE_VIEW_CONFIG.wheelZoomRate),
        );
        return;
      }

      const horizontal = event.shiftKey && event.deltaX === 0;
      panBy(
        (horizontal ? event.deltaY : event.deltaX) * unit,
        (horizontal ? 0 : event.deltaY) * unit,
      );
    };

    dialog.addEventListener("wheel", onWheel, { passive: false });
    return () => dialog.removeEventListener("wheel", onWheel);
  }, [panBy, zoomAt]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || event.defaultPrevented) return;

      if (event.key === "Tab") {
        const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (element) => element.offsetParent !== null,
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        const inside = dialog.contains(document.activeElement);
        if (event.shiftKey && (!inside || document.activeElement === first)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const onControl =
        event.target instanceof HTMLElement && Boolean(event.target.closest("button, a"));
      const page = (viewportRef.current?.clientHeight ?? 400) * 0.85;
      const step = SOURCE_VIEW_CONFIG.keyboardPanStep;
      const zoomFactor = 1 + SOURCE_VIEW_CONFIG.zoomStep;
      const actions: Record<string, () => void> = {
        Escape: onClose,
        ArrowRight: () => go(1),
        ArrowLeft: () => go(-1),
        ArrowDown: () => panBy(0, step),
        ArrowUp: () => panBy(0, -step),
        PageDown: () => panBy(0, page),
        PageUp: () => panBy(0, -page),
        Home: () => panBy(0, -Number.MAX_SAFE_INTEGER),
        End: () => panBy(0, Number.MAX_SAFE_INTEGER),
        "+": () => zoomCentre(zoomFactor),
        "=": () => zoomCentre(zoomFactor),
        "-": () => zoomCentre(1 / zoomFactor),
        "0": fitPage,
        ...(onControl ? {} : { " ": () => panBy(0, event.shiftKey ? -page : page) }),
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fitPage, go, onClose, panBy, zoomCentre]);

  useEffect(() => {
    const active = document.activeElement;
    if (
      !active ||
      active === document.body ||
      (active instanceof HTMLButtonElement && active.disabled)
    ) {
      dialogRef.current?.focus();
    }
  }, [position]);

  if (!source) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:p-8 lg:p-10"
      onPointerDown={(event) => {
        pressedOverlay.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOverlay.current && event.target === event.currentTarget) onClose();
        pressedOverlay.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-viewer-title"
        aria-describedby="source-viewer-description"
        tabIndex={-1}
        className="flex h-full max-h-224 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--bg) shadow-2xl outline-none"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-(--border) px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2
              id="source-viewer-title"
              className="truncate text-sm font-semibold text-(--text-1)"
              title={source.reference}
            >
              <span className="text-(--accent) tabular-nums">[{source.index}]</span>{" "}
              {source.reference}
            </h2>
            <p id="source-viewer-description" className="mt-0.5 truncate text-xs text-(--text-3)">
              {SOURCE_LABELS[source.sourceType]}
              {source.grade ? ` · ${source.grade}` : ""}
            </p>
          </div>
          <ToolButton label="বন্ধ করুন" onClick={onClose}>
            <CloseIcon />
          </ToolButton>
        </header>

        <TransformWrapper
          key={`${reference}-${rendered ? "ready" : "waiting"}`}
          ref={transformRef}
          initialScale={1}
          minScale={SOURCE_VIEW_CONFIG.minScale}
          maxScale={SOURCE_VIEW_CONFIG.maxScale}
          limitToBounds
          centerZoomedOut
          doubleClick={{ mode: "toggle", step: 0.8 }}
          wheel={{ disabled: true }}
          trackPadPanning={{ disabled: true }}
          panning={{ velocityDisabled: true, excluded: ["source-viewer-ignore"] }}
          pinch={{ step: 5 }}
        >
          {() => (
            <>
              <div
                ref={viewportRef}
                className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-(--surface-2) active:cursor-grabbing"
                aria-busy={!rendered && !error}
              >
                {!rendered && !error ? (
                  <div
                    role="status"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-(--text-2)"
                  >
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-(--border) border-t-(--accent)" />
                    সূত্রের পাতা তৈরি হচ্ছে…
                  </div>
                ) : null}

                {error ? (
                  <div
                    role="alert"
                    className="absolute inset-0 flex cursor-default flex-col items-center justify-center gap-3 px-6 text-center text-sm text-(--text-2)"
                  >
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={() => setAttempt((value) => value + 1)}
                      className="rounded-lg border border-(--border) bg-(--bg) px-4 py-2 text-(--text-1) transition hover:bg-(--surface-3)"
                    >
                      আবার চেষ্টা করুন
                    </button>
                  </div>
                ) : null}

                {rendered ? (
                  <TransformComponent
                    wrapperClass="!h-full !w-full"
                    contentClass="!w-full flex flex-col items-center gap-4 py-4"
                  >
                    {rendered.pages.map((page, index) => {
                      const highlighted = rendered.highlight?.page === index + 1;
                      return (
                        <div
                          key={page.src}
                          className="relative w-[min(100%-2rem,42rem)] overflow-hidden rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)]"
                          style={{ aspectRatio: `${page.width} / ${page.height}` }}
                        >
                          <img
                            src={page.src}
                            alt={`${source.reference}, পাতা ${index + 1} / ${rendered.pages.length}`}
                            draggable={false}
                            decoding="async"
                            className="block h-full w-full select-none"
                            onLoad={highlighted ? () => focusHighlight(false) : undefined}
                          />
                          {highlighted ? (
                            <div
                              ref={markerRef}
                              aria-hidden="true"
                              className="pointer-events-none absolute left-0 h-px w-full"
                              style={{ top: `${(rendered.highlight?.top ?? 0) * 100}%` }}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </TransformComponent>
                ) : null}
              </div>

              <footer className="flex shrink-0 items-center justify-between gap-1 border-t border-(--border) px-2 py-2 sm:px-3">
                <div className="flex items-center gap-0.5">
                  <ToolButton label="আগের সূত্র" onClick={() => go(-1)} disabled={position === 0}>
                    <ChevronLeftIcon />
                  </ToolButton>
                  <span className="min-w-10 text-center text-xs text-(--text-3) tabular-nums">
                    {position + 1}/{sources.length}
                  </span>
                  <ToolButton
                    label="পরের সূত্র"
                    onClick={() => go(1)}
                    disabled={position === sources.length - 1}
                  >
                    <ChevronRightIcon />
                  </ToolButton>
                </div>

                <div className="flex items-center gap-0.5">
                  <ToolButton
                    label="ছোট করুন"
                    onClick={() => zoomCentre(1 / (1 + SOURCE_VIEW_CONFIG.zoomStep))}
                    disabled={!rendered}
                  >
                    <ZoomOutIcon />
                  </ToolButton>
                  {rendered ? <ZoomLevel onReset={fitPage} /> : null}
                  <ToolButton
                    label="বড় করুন"
                    onClick={() => zoomCentre(1 + SOURCE_VIEW_CONFIG.zoomStep)}
                    disabled={!rendered}
                  >
                    <ZoomInIcon />
                  </ToolButton>
                  <ToolButton label="পাতার মাপে ফিরুন" onClick={fitPage} disabled={!rendered}>
                    <FitPageIcon />
                  </ToolButton>
                  <ToolButton
                    label="হাইলাইট করা অংশে যান"
                    onClick={() => focusHighlight(true)}
                    disabled={!rendered?.highlight}
                  >
                    <HighlighterIcon />
                  </ToolButton>
                </div>

                <div className="flex items-center gap-0.5">
                  <ToolButton
                    label={DELIVERY_LABELS[delivery?.key === reference ? delivery.state : "idle"]}
                    onClick={() => {
                      if (!rendered) return;
                      const state = downloadRenderedSource(rendered, reference);
                      setDelivery({ key: reference, state });
                    }}
                    disabled={!rendered}
                  >
                    {delivery?.key === reference && delivery.state !== "failed" ? (
                      <CheckIcon />
                    ) : (
                      <DownloadIcon />
                    )}
                  </ToolButton>
                  <span role="status" className="sr-only">
                    {delivery?.key === reference ? DELIVERY_LABELS[delivery.state] : ""}
                  </span>
                  {rendered?.externalUrl ? (
                    <a
                      href={rendered.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ICON_BUTTON}
                      aria-label="মূল উৎসে খুলুন"
                      title="মূল উৎসে খুলুন"
                    >
                      <ExternalLinkIcon />
                    </a>
                  ) : null}
                </div>
              </footer>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
