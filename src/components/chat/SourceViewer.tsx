"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { clsx } from "clsx";
import { loadRenderedSource, type RenderedSource } from "@/lib/sourceView/clientPdf";
import type { AnswerSource } from "@/types";

interface SourceViewerProps {
  sources: AnswerSource[];
  startIndex: number;
  onClose: () => void;
}

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rendered: RenderedSource };

const BUTTON_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-full border border-(--border) bg-(--surface-2) text-(--text-1) transition duration-200 hover:bg-(--surface-3) active:scale-95 disabled:pointer-events-none disabled:opacity-40";

const SOURCE_LABELS: Record<AnswerSource["sourceType"], string> = {
  quran: "কুরআন",
  hadith: "হাদিস",
  ijma: "ইজমা",
  qiyas: "কিয়াস",
  sirat: "সীরাত",
};

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function SourceViewer({ sources, startIndex, onClose }: SourceViewerProps) {
  const [position, setPosition] = useState(startIndex);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const source = sources[position];

  const go = useCallback(
    (delta: number) => {
      setPosition((current) => {
        const next = current + delta;
        return next < 0 || next >= sources.length ? current : next;
      });
    },
    [sources.length],
  );

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, onClose]);

  useEffect(() => {
    if (!source) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) setView({ status: "loading" });
    }, 0);

    loadRenderedSource(source.reference)
      .then((rendered) => {
        if (active) setView({ status: "ready", rendered });
      })
      .catch((error: unknown) => {
        if (active) {
          setView({
            status: "error",
            message: error instanceof Error ? error.message : "সূত্রটি এখন দেখানো যাচ্ছে না।",
          });
        }
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [source, attempt]);

  const focusHighlight = useCallback(() => {
    const transform = transformRef.current;
    const marker = markerRef.current;
    const content = transform?.instance.contentComponent;
    if (!transform || !marker || !content) return;
    const scale = transform.state.scale || 1;
    const offset =
      (marker.getBoundingClientRect().top - content.getBoundingClientRect().top) / scale;
    const visibleHeight = transform.instance.wrapperComponent?.clientHeight ?? 0;
    const target = offset < visibleHeight * 0.55 ? 0 : offset - 24;
    void transform.setTransform(0, -target, 1, 250);
  }, []);

  if (!source) return null;

  const rendered = view.status === "ready" ? view.rendered : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={source.reference}
      className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-(--border) bg-(--bg) px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-(--text-1)">
            [{source.index}] {source.reference}
          </p>
          <p className="truncate text-xs text-(--text-3)">
            {SOURCE_LABELS[source.sourceType]} · {position + 1} / {sources.length}
            {rendered?.highlight ? " · হাইলাইট করা অংশটিই উত্তরে ব্যবহৃত হয়েছে" : ""}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={BUTTON_CLASS}
          aria-label="বন্ধ করুন"
        >
          <Icon path="M6 6l12 12M18 6L6 18" />
        </button>
      </header>

      <TransformWrapper
        key={`${source.reference}-${view.status}`}
        ref={transformRef}
        initialScale={1}
        minScale={0.6}
        maxScale={6}
        limitToBounds
        centerZoomedOut
        doubleClick={{ mode: "toggle", step: 1.2 }}
        pinch={{ step: 6 }}
        wheel={{ step: 0.12, activationKeys: ["Control", "Meta"] }}
        trackPadPanning={{ velocityDisabled: true, lockAxisX: true }}
        panning={{ velocityDisabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }: ReactZoomPanPinchRef) => (
          <>
            <div
              className="relative min-h-0 flex-1 overflow-hidden"
              aria-live="polite"
              aria-busy={view.status === "loading"}
            >
              {view.status === "loading" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-white/85">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  সূত্রের পাতা তৈরি হচ্ছে…
                </div>
              ) : null}

              {view.status === "error" ? (
                <div
                  role="alert"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-white/90"
                >
                  <p>{view.message}</p>
                  <button
                    type="button"
                    onClick={() => setAttempt((value) => value + 1)}
                    className="rounded-full bg-white/15 px-4 py-2 text-white transition hover:bg-white/25"
                  >
                    আবার চেষ্টা করুন
                  </button>
                </div>
              ) : null}

              {rendered ? (
                <TransformComponent
                  wrapperClass="!h-full !w-full"
                  contentClass="!w-full flex flex-col items-center gap-3 py-3"
                >
                  {rendered.pages.map((page, index) => {
                    const highlighted = rendered.highlight?.page === index + 1;
                    return (
                      <div
                        key={page.src}
                        className="relative w-[min(100%-1.5rem,46rem)] overflow-hidden rounded-lg bg-white shadow-2xl"
                        style={{ aspectRatio: `${page.width} / ${page.height}` }}
                      >
                        <img
                          src={page.src}
                          alt={`${source.reference}, পাতা ${index + 1}`}
                          draggable={false}
                          className="h-full w-full select-none"
                          onLoad={highlighted ? focusHighlight : undefined}
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

            <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-(--border) bg-(--bg) px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={position === 0}
                className={BUTTON_CLASS}
                aria-label="আগের সূত্র"
              >
                <Icon path="M15 18l-6-6 6-6" />
              </button>
              <button
                type="button"
                onClick={() => zoomOut()}
                className={BUTTON_CLASS}
                aria-label="ছোট করুন"
                disabled={!rendered}
              >
                <Icon path="M5 12h14" />
              </button>
              <button
                type="button"
                onClick={() => zoomIn()}
                className={BUTTON_CLASS}
                aria-label="বড় করুন"
                disabled={!rendered}
              >
                <Icon path="M12 5v14M5 12h14" />
              </button>
              <button
                type="button"
                onClick={() => {
                  resetTransform(0);
                  focusHighlight();
                }}
                className={BUTTON_CLASS}
                aria-label="হাইলাইট করা অংশে যান"
                disabled={!rendered}
              >
                <Icon path="M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3" />
              </button>
              <a
                href={rendered?.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(BUTTON_CLASS, !rendered && "pointer-events-none opacity-40")}
                aria-label="PDF নতুন ট্যাবে খুলুন"
              >
                <Icon path="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h6" />
              </a>
              {rendered?.externalUrl ? (
                <a
                  href={rendered.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={BUTTON_CLASS}
                  aria-label="মূল উৎসে খুলুন"
                >
                  <Icon path="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => go(1)}
                disabled={position === sources.length - 1}
                className={BUTTON_CLASS}
                aria-label="পরের সূত্র"
              >
                <Icon path="M9 18l6-6-6-6" />
              </button>
            </footer>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
