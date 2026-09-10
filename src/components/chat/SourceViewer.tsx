"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { clsx } from "clsx";
import type { AnswerSource } from "@/types";

interface SourceViewerProps {
  sources: AnswerSource[];
  startIndex: number;
  onClose: () => void;
}

const BUTTON_CLASS =
  "glass glass-sheen flex h-9 w-9 items-center justify-center rounded-full text-(--text-1) transition duration-200 hover:brightness-[1.1] active:scale-95 disabled:pointer-events-none disabled:opacity-40";

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
  const [rotation, setRotation] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const source = sources[position];

  const go = useCallback(
    (delta: number) => {
      setPosition((current) => {
        const next = current + delta;
        if (next < 0 || next >= sources.length) return current;
        setRotation(0);
        setLoaded(false);
        return next;
      });
    },
    [sources.length],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  if (!source?.url) return null;

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
      <header className="glass glass-sheen flex shrink-0 items-center gap-2 border-0 px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-(--text-1)">{source.reference}</p>
          <p className="truncate text-xs text-(--text-3)">
            {position + 1} / {sources.length}
            {source.page ? ` · পৃষ্ঠা ${source.page}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className={BUTTON_CLASS} aria-label="বন্ধ করুন">
          <Icon path="M6 6l12 12M18 6L6 18" />
        </button>
      </header>

      <TransformWrapper
        key={`${position}-${rotation}`}
        initialScale={1}
        minScale={0.5}
        maxScale={8}
        doubleClick={{ mode: "toggle", step: 1.6 }}
        pinch={{ step: 8 }}
        wheel={{ step: 0.15 }}
        panning={{ velocityDisabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }: ReactZoomPanPinchRef) => (
          <>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              <TransformComponent
                wrapperClass="!h-full !w-full"
                contentClass="!h-full !w-full flex items-center justify-center"
              >
                <img
                  src={source.url}
                  alt={source.reference}
                  onLoad={() => setLoaded(true)}
                  draggable={false}
                  style={{ transform: `rotate(${rotation}deg)` }}
                  className={clsx(
                    "max-h-[78vh] max-w-[94vw] rounded-lg object-contain transition-opacity duration-200",
                    loaded ? "opacity-100" : "opacity-0",
                  )}
                />
              </TransformComponent>
            </div>

            <footer className="glass glass-sheen flex shrink-0 items-center justify-center gap-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={position === 0}
                className={BUTTON_CLASS}
                aria-label="আগেরটি"
              >
                <Icon path="M15 18l-6-6 6-6" />
              </button>
              <button
                type="button"
                onClick={() => zoomOut()}
                className={BUTTON_CLASS}
                aria-label="ছোট করুন"
              >
                <Icon path="M5 12h14M21 21l-4.35-4.35" />
              </button>
              <button
                type="button"
                onClick={() => zoomIn()}
                className={BUTTON_CLASS}
                aria-label="বড় করুন"
              >
                <Icon path="M12 5v14M5 12h14" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((value) => (value + 90) % 360)}
                className={BUTTON_CLASS}
                aria-label="ঘোরান"
              >
                <Icon path="M21 2v6h-6M21 13a9 9 0 11-3-7.7L21 8" />
              </button>
              <button
                type="button"
                onClick={() => {
                  resetTransform();
                  setRotation(0);
                }}
                className={BUTTON_CLASS}
                aria-label="আগের অবস্থায়"
              >
                <Icon path="M3 12a9 9 0 109-9 9 9 0 00-9 9zm0 0h4m-4 0v-4" />
              </button>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={BUTTON_CLASS}
                aria-label="নতুন ট্যাবে খুলুন"
              >
                <Icon path="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </a>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={position === sources.length - 1}
                className={BUTTON_CLASS}
                aria-label="পরেরটি"
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
