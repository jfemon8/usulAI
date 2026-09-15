"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { clsx } from "clsx";
import { Button, IconButton } from "@/components/admin/ui";
import { CheckIcon, CloseIcon, AlertIcon } from "@/components/ui/Icons";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  busy?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const pressedOverlay = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { body } = document;
    const overflow = body.style.overflow;
    body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>(
      "[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    );
    (first ?? panelRef.current)?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ];
      const firstItem = focusable[0];
      const lastItem = focusable.at(-1);
      if (!firstItem || !lastItem) return;
      if (event.shiftKey && document.activeElement === firstItem) {
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
      body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return (
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
        tabIndex={-1}
        data-state="open"
        className={clsx(
          "sheet-panel relative flex max-h-[calc(100dvh-max(2.5rem,env(safe-area-inset-top)+1.5rem))] w-full flex-col overflow-hidden rounded-t-[1.25rem] border border-b-0 border-(--border) bg-(--bg) shadow-2xl outline-none sm:max-h-[min(90dvh,56rem)] sm:rounded-2xl sm:border-b",
          size === "xl" ? "sm:max-w-4xl" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <header className="flex shrink-0 items-start gap-2 border-b border-(--border) px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-(--text-1) sm:text-lg">
              {title}
            </h2>
            {description ? (
              <div className="mt-0.5 text-sm text-(--text-3)">{description}</div>
            ) : null}
          </div>
          <IconButton label="বন্ধ করুন" onClick={onClose} disabled={busy}>
            <CloseIcon className="h-5 w-5" />
          </IconButton>
        </header>
        {children ? (
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {children}
          </div>
        ) : null}
        {footer ? (
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-(--border) px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 sm:pb-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "নিশ্চিত করুন",
  tone = "danger",
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            বাতিল
          </Button>
          <Button
            tone={tone}
            onClick={onConfirm}
            loading={busy}
            data-autofocus
            className="w-full sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-6 text-(--text-2)">{message}</div>
    </Dialog>
  );
}

interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
}

const ToastContext = createContext<{
  success: (message: string) => void;
  error: (message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((tone: Toast["tone"], message: string) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  }, []);

  const value = useMemo(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 sm:right-6 sm:left-auto sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className="rise-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-sm text-(--text-1) shadow-xl"
          >
            {toast.tone === "error" ? (
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-(--danger)" />
            ) : (
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-(--accent)" />
            )}
            <span className="min-w-0 break-words">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
