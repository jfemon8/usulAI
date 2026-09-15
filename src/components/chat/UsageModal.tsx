"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clsx } from "clsx";
import { CloseIcon, RetryIcon } from "@/components/ui/Icons";
import { CHAT_HISTORY_CONFIG, RATE_LIMIT_CONFIG } from "@/config/site";
import { conversationStore } from "@/lib/chat/conversations";
import type { UsageResponse, WindowUsage } from "@/lib/usage/types";
import {
  bn,
  formatClock,
  formatDuration,
  localUsage,
  remainingToday,
  usageLevel,
  usageRatio,
  type UsageLevel,
} from "@/lib/usage/usageView";
import type { UsulUIMessage } from "@/types";

interface UsageModalProps {
  open: boolean;
  onClose: () => void;
  messages: UsulUIMessage[];
  persistent: boolean;
}

interface LoadState {
  data: UsageResponse | null;
  fetchedAt: number;
  offsetMs: number;
  loading: boolean;
  error: string | null;
}

const FALLBACK_ERROR = "ব্যবহারের তথ্য এখন আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।";
const EMPTY_CONVERSATIONS: never[] = [];
const INITIAL: LoadState = { data: null, fetchedAt: 0, offsetMs: 0, loading: true, error: null };

const LEVEL_STYLES: Record<UsageLevel, { bar: string; text: string }> = {
  normal: { bar: "bg-(--accent)", text: "text-(--text-3)" },
  warning: { bar: "bg-(--warn)", text: "text-(--warn)" },
  critical: { bar: "bg-(--danger)", text: "text-(--danger)" },
};

function UsageBar({
  id,
  label,
  used,
  limit,
  hint,
  valueText,
}: {
  id: string;
  label: string;
  used: number;
  limit: number;
  hint: string;
  valueText?: string;
}) {
  const styles = LEVEL_STYLES[usageLevel(used, limit)];
  const percent = Math.round(usageRatio(used, limit) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-sm font-medium text-(--text-1)">
          {label}
        </span>
        <span className="shrink-0 text-sm text-(--text-1) tabular-nums">
          {valueText ?? `${bn(used)} / ${bn(limit)}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={`${id}-label`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${bn(percent)}% ব্যবহৃত, ${hint}`}
        className="h-2 w-full overflow-hidden rounded-full bg-(--surface-3)"
      >
        <div
          className={clsx(
            "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
            styles.bar,
          )}
          style={{ width: `${Math.max(percent, used > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className={clsx("text-xs leading-5", styles.text)}>{hint}</p>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-(--border) pt-5">
      <div>
        <h3 className="text-base font-semibold text-(--text-1)">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-(--text-3)">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
      <span className="text-(--text-2)">{label}</span>
      <span className="text-(--text-1) tabular-nums">{value}</span>
    </div>
  );
}

async function requestUsage(): Promise<Partial<LoadState>> {
  try {
    const started = Date.now();
    const response = await fetch("/api/usage", { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as
      (UsageResponse & { error?: string }) | null;
    if (!response.ok || !body || body.error) return { error: body?.error ?? FALLBACK_ERROR };
    const received = Date.now();
    return {
      data: body,
      fetchedAt: received,
      offsetMs: body.serverTime - Math.round((started + received) / 2),
      error: null,
    };
  } catch {
    return { error: FALLBACK_ERROR };
  }
}

function remainingHint(usage: WindowUsage, now: number, action: string): string {
  const left = Math.max(0, usage.limit - usage.used);
  const reset = formatDuration(usage.resetsAt - now);
  if (usage.used === 0) return `আরও ${bn(left)} বার ${action} যাবে`;
  return left === 0
    ? `সীমা পূর্ণ, ${reset} পর আবার ${action} যাবে`
    : `আরও ${bn(left)} বার ${action} যাবে · ${reset} পর নতুন করে গণনা শুরু হবে, ইং-শা-আল্লাহ`;
}

interface DragState {
  pointerId: number;
  startY: number;
  offset: number;
  lastY: number;
  lastTime: number;
  velocity: number;
}

const SHEET_QUERY = "(max-width: 39.99rem)";
const DISMISS_DISTANCE = 120;
const DISMISS_RATIO = 0.3;
const DISMISS_VELOCITY = 0.6;
const ANIMATION_FALLBACK_MS = 450;
const SNAP_BACK = "transform 0.24s cubic-bezier(0.32, 0.72, 0, 1)";

export function UsageModal({ open, onClose, messages, persistent }: UsageModalProps) {
  const [state, setState] = useState<LoadState>(INITIAL);
  const [clock, setClock] = useState(() => Date.now());
  const [wasOpen, setWasOpen] = useState(open);
  const [rendered, setRendered] = useState(open);
  const [entered, setEntered] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const pressedOverlay = useRef(false);
  const refreshedFor = useRef(new Set<number>());

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRendered(true);
      setEntered(false);
    }
  }

  const closing = rendered && !open;
  const phase = closing ? "closed" : entered ? "idle" : "open";

  useEffect(() => {
    if (!rendered || phase === "idle") return;
    const timer = setTimeout(() => {
      if (phase === "closed") setRendered(false);
      else setEntered(true);
    }, ANIMATION_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [rendered, phase]);

  useEffect(() => {
    if (!rendered) return;
    const { body, documentElement } = document;
    const previous = [body.style.overflow, documentElement.style.overflow];
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous[0] ?? "";
      documentElement.style.overflow = previous[1] ?? "";
    };
  }, [rendered]);

  function finishAnimation(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (closing) {
      setRendered(false);
      return;
    }
    event.currentTarget.style.removeProperty("--sheet-drag");
    overlayRef.current?.style.removeProperty("--overlay-from");
    setEntered(true);
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!open || !entered || drag.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    if (!window.matchMedia(SHEET_QUERY).matches) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      offset: 0,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
    };
    if (dialogRef.current) dialogRef.current.style.transition = "none";
    if (overlayRef.current) overlayRef.current.style.transition = "none";
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    const panel = dialogRef.current;
    if (!current || !panel || event.pointerId !== current.pointerId) return;
    const delta = event.clientY - current.startY;
    const offset = delta >= 0 ? delta : -Math.sqrt(-delta) * 2;
    const elapsed = Math.max(1, event.timeStamp - current.lastTime);
    current.velocity = (event.clientY - current.lastY) / elapsed;
    current.lastY = event.clientY;
    current.lastTime = event.timeStamp;
    current.offset = offset;
    panel.style.transform = `translateY(${offset}px)`;
    if (overlayRef.current) {
      const fade = Math.max(0, Math.min(1, offset / panel.offsetHeight));
      overlayRef.current.style.opacity = String(1 - fade * 0.7);
    }
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    const panel = dialogRef.current;
    const overlay = overlayRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    drag.current = null;
    if (!panel) return;

    const distance = Math.min(DISMISS_DISTANCE, panel.offsetHeight * DISMISS_RATIO);
    const dismiss =
      event.type !== "pointercancel" &&
      current.offset > 0 &&
      (current.offset > distance || current.velocity > DISMISS_VELOCITY);

    if (dismiss) {
      panel.style.setProperty("--sheet-drag", `${current.offset}px`);
      panel.style.transition = "";
      panel.style.transform = "";
      if (overlay) {
        overlay.style.setProperty("--overlay-from", overlay.style.opacity || "1");
        overlay.style.transition = "";
        overlay.style.opacity = "";
      }
      onClose();
      return;
    }

    panel.style.transition = SNAP_BACK;
    panel.style.transform = "";
    if (overlay) {
      overlay.style.transition = "opacity 0.24s ease-out";
      overlay.style.opacity = "";
    }
  }

  const stored = useSyncExternalStore(
    conversationStore.subscribe,
    conversationStore.getSnapshot,
    conversationStore.getServerSnapshot,
  );
  const conversations = persistent ? stored : EMPTY_CONVERSATIONS;

  const apply = useCallback((result: Partial<LoadState>) => {
    setState((current) => ({ ...current, ...result, loading: false }));
  }, []);

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    void requestUsage().then(apply);
  }, [apply]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void requestUsage().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [open, apply]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  const now = clock + state.offsetMs;

  useEffect(() => {
    if (!open || !state.data || state.loading) return;
    const chat = state.data.scopes.chat;
    const due = [chat.minute, chat.hour, chat.day].find(
      (usage) =>
        usage.used > 0 && now >= usage.resetsAt && !refreshedFor.current.has(usage.resetsAt),
    );
    if (!due) return;
    refreshedFor.current.add(due.resetsAt);
    let active = true;
    void requestUsage().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [open, now, state.data, state.loading, apply]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href]"),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!rendered) return null;

  const { data } = state;
  const local = localUsage(conversations, messages);
  const chat = data?.scopes.chat;
  const blocked = chat
    ? [chat.minute, chat.hour, chat.day].find((usage) => usage.used >= usage.limit)
    : undefined;
  const maxMessages = CHAT_HISTORY_CONFIG.maxMessagesPerConversation;
  const maxConversations = CHAT_HISTORY_CONFIG.maxConversations;

  const stats = [
    { label: "আজকের প্রশ্নের সীমা", value: chat ? bn(remainingToday(chat)) : "…" },
    {
      label: "সংরক্ষিত কথোপকথন",
      value: persistent ? `${bn(local.conversations)}/${bn(maxConversations)}` : "নেই",
    },
    { label: "এই মুহূর্তে প্রশ্নের সীমা", value: bn(local.questions) },
  ];

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6",
        closing && "pointer-events-none",
      )}
      aria-hidden={closing || undefined}
      inert={closing || undefined}
      onPointerDown={(event) => {
        pressedOverlay.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOverlay.current && event.target === event.currentTarget) onClose();
        pressedOverlay.current = false;
      }}
    >
      <div
        ref={overlayRef}
        data-state={phase}
        aria-hidden="true"
        className="sheet-overlay pointer-events-none absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-title"
        aria-describedby="usage-description"
        tabIndex={-1}
        data-state={phase}
        onAnimationEnd={finishAnimation}
        className="sheet-panel relative flex h-[calc(100dvh-max(3.5rem,env(safe-area-inset-top)+2.5rem))] w-full flex-col overflow-hidden rounded-t-[1.25rem] border border-b-0 border-(--border) bg-(--bg) shadow-2xl outline-none sm:h-auto sm:max-h-[min(92dvh,52rem)] sm:max-w-xl sm:rounded-2xl sm:border-b"
      >
        <div
          className="shrink-0 touch-none select-none sm:touch-auto sm:select-auto"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden" aria-hidden="true">
            <span className="h-1.5 w-10 rounded-full bg-(--border-strong)" />
          </div>
          <header className="flex items-start gap-1 border-b border-(--border) px-4 pt-2 pb-3.5 sm:gap-2 sm:px-5 sm:py-4">
            <div className="min-w-0 flex-1">
              <h2
                id="usage-title"
                className="text-[1.0625rem] leading-6 font-semibold text-(--text-1) sm:text-lg"
              >
                ব্যবহারের হিসাব
              </h2>
              <p
                id="usage-description"
                className="mt-0.5 text-[0.8125rem] leading-5 text-(--text-3) sm:text-sm"
              >
                আপনার প্রশ্নের সীমা এবং কথোপকথন আর আজকের ব্যবহার
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={state.loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-2) transition hover:bg-(--surface-2) active:bg-(--surface-3) disabled:opacity-60 sm:h-9 sm:w-9"
              aria-label="তথ্য হালনাগাদ করুন"
              title="হালনাগাদ করুন"
            >
              <RetryIcon
                className={clsx(
                  "h-4 w-4",
                  state.loading && "animate-spin motion-reduce:animate-none",
                )}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-2) transition hover:bg-(--surface-2) active:bg-(--surface-3) sm:h-9 sm:w-9"
              aria-label="বন্ধ করুন"
              title="বন্ধ করুন"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>
        </div>

        <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] sm:px-5 sm:pt-5">
          <div className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex min-w-0 flex-col justify-between rounded-xl bg-(--surface-2) px-2.5 py-2.5 sm:px-3"
              >
                <p className="text-[0.6875rem] leading-4 text-(--text-3) sm:text-xs">
                  {stat.label}
                </p>
                <p className="mt-1 text-base leading-6 font-semibold text-(--text-1) tabular-nums sm:text-lg">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {blocked ? (
            <p
              role="status"
              className="rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-(--danger)"
            >
              এখন নতুন প্রশ্ন করা যাবে না। {formatDuration(blocked.resetsAt - now)} পর আবার চেষ্টা
              করুন।
            </p>
          ) : null}

          {state.error ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl bg-(--surface-2) px-4 py-3 text-sm text-(--text-2)"
            >
              <span>{state.error}</span>
              <button
                type="button"
                onClick={load}
                className="shrink-0 rounded-full border border-(--border) px-3 py-1.5 text-(--text-1) hover:bg-(--surface-3)"
              >
                আবার চেষ্টা
              </button>
            </div>
          ) : null}

          <Section title="প্রশ্ন করার সীমা">
            {chat ? (
              <>
                <UsageBar
                  id="chat-minute"
                  label="এই মিনিটে"
                  used={chat.minute.used}
                  limit={chat.minute.limit}
                  hint={remainingHint(chat.minute, now, "প্রশ্ন করা")}
                />
                <UsageBar
                  id="chat-hour"
                  label="এই ঘণ্টায়"
                  used={chat.hour.used}
                  limit={chat.hour.limit}
                  hint={remainingHint(chat.hour, now, "প্রশ্ন করা")}
                />
                <UsageBar
                  id="chat-day"
                  label="আজ"
                  used={chat.day.used}
                  limit={chat.day.limit}
                  hint={remainingHint(chat.day, now, "প্রশ্ন করা")}
                />
              </>
            ) : state.error ? null : (
              <div className="flex flex-col gap-4" aria-hidden="true">
                {[0, 1, 2].map((key) => (
                  <div
                    key={key}
                    className="h-12 animate-pulse rounded-lg bg-(--surface-2) motion-reduce:animate-none"
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="এই কথোপকথন">
            <UsageBar
              id="conversation-saved"
              label="সংরক্ষিত মেসেজ"
              used={Math.min(local.messages, maxMessages)}
              limit={maxMessages}
              valueText={
                local.messages > maxMessages
                  ? `${bn(maxMessages)} / ${bn(maxMessages)} (+${bn(local.messages - maxMessages)} কম্প্যাক্ট)`
                  : undefined
              }
              hint={
                local.messages >= maxMessages
                  ? `শেষ ${bn(maxMessages)}টি মেসেজ পুরোটা সংরক্ষিত থাকবে, বাকীগুলো কম্প্যাক্ট অবস্থায় থাকবে`
                  : `আরও ${bn(maxMessages - local.messages)}টি মেসেজ পর্যন্ত পুরোটা সংরক্ষিত থাকবে, বাকীগুলো কম্প্যাক্ট অবস্থায় থাকবে`
              }
            />
            {/* <InfoRow
              label="একটি প্রশ্নের সর্বোচ্চ দৈর্ঘ্য"
              value={`${bn(data?.limits.maxQuestionChars ?? RATE_LIMIT_CONFIG.maxQuestionChars)} অক্ষর`}
            /> */}
          </Section>

          {data ? (
            <Section title="অন্যান্য ব্যবহার" description="আজকের হিসাব">
              <UsageBar
                id="source-day"
                label="সূত্র দেখা"
                used={data.scopes.sourceView.day.used}
                limit={data.scopes.sourceView.day.limit}
                hint={remainingHint(data.scopes.sourceView.day, now, "দেখা")}
              />
              <UsageBar
                id="feedback-day"
                label="মতামত পাঠানো"
                used={data.scopes.feedback.day.used}
                limit={data.scopes.feedback.day.limit}
                hint={remainingHint(data.scopes.feedback.day, now, "পাঠানো")}
              />
            </Section>
          ) : null}

          <p className="border-t border-(--border) pt-4 text-xs leading-5 text-(--text-3)">
            {data ? `সর্বশেষ হালনাগাদ ${formatClock(state.fetchedAt)}। ` : ""}
            যেকোনো সময় Chat Box-এ{" "}
            <code className="rounded bg-(--surface-2) px-1 font-mono">/usage</code> লিখে এই হিসাব
            দেখতে পারবেন।
          </p>
        </div>
      </div>
    </div>
  );
}
