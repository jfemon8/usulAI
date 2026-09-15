"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/ui/Icons";

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function HelpSheet({
  title,
  description,
  onClose,
  busy = false,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pressedOverlay = useRef(false);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { body, documentElement } = document;
    const overflow = [body.style.overflow, documentElement.style.overflow];
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    const first = panelRef.current?.querySelector<HTMLElement>(
      "[data-autofocus], textarea:not([disabled]), input:not([disabled])",
    );
    (first ?? panelRef.current)?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const firstItem = focusable[0];
      const lastItem = focusable.at(-1);
      if (!firstItem || !lastItem) return;
      if (
        event.shiftKey &&
        (document.activeElement === firstItem || document.activeElement === panelRef.current)
      ) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = overflow[0] ?? "";
      documentElement.style.overflow = overflow[1] ?? "";
      previous?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      onPointerDown={(event) => {
        pressedOverlay.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOverlay.current && event.target === event.currentTarget && !busy) onClose();
        pressedOverlay.current = false;
      }}
    >
      <div
        data-state="open"
        aria-hidden="true"
        className="sheet-overlay pointer-events-none absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-state="open"
        className="sheet-panel relative flex max-h-[calc(100dvh-max(2.5rem,env(safe-area-inset-top)+1.5rem))] w-full flex-col overflow-hidden rounded-t-[1.25rem] border border-b-0 border-(--border) bg-(--bg) text-(--text-1) shadow-2xl outline-none sm:max-h-[min(92dvh,52rem)] sm:max-w-xl sm:rounded-2xl sm:border-b"
      >
        <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-(--border-strong)" />
        </div>
        <header className="flex shrink-0 items-start gap-2 border-b border-(--border) px-4 pt-2 pb-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[1.0625rem] leading-6 font-semibold sm:text-lg">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-0.5 text-[0.8125rem] leading-5 text-(--text-3) sm:text-sm"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-2) transition hover:bg-(--surface-2) active:bg-(--surface-3) disabled:opacity-50 sm:h-9 sm:w-9"
            aria-label="বন্ধ করুন"
            title="বন্ধ করুন"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-(--border) px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-5 sm:pb-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
