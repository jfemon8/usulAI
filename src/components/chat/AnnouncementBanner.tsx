"use client";

import { useSyncExternalStore } from "react";
import { clsx } from "clsx";
import { AlertIcon, CloseIcon, ExternalLinkIcon } from "@/components/ui/Icons";
import { isExternalLink, safeLinkUrl, type Announcement } from "@/lib/site/contentShape";

const STORAGE_KEY = "usul-ai:announcement-dismissed";
const listeners = new Set<() => void>();

function dismissalKey(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }
  return `${text.length}:${hash.toString(36)}`;
}

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

let dismissedInMemory: string | null = null;

function dismiss(key: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    dismissedInMemory = key;
  }
  for (const listener of listeners) listener();
}

export function AnnouncementView({
  announcement,
  compact = false,
  onDismiss,
}: {
  announcement: Announcement;
  compact?: boolean;
  onDismiss?: () => void;
}) {
  const href = announcement.link ? safeLinkUrl(announcement.link.url) : null;
  const external = href ? isExternalLink(href) : false;
  const warning = announcement.tone === "warning";

  return (
    <aside
      aria-label="ঘোষণা"
      className={clsx(
        "flex shrink-0 items-start gap-2 border-b border-(--border) text-sm leading-6",
        compact ? "px-3 py-1.5" : "px-3 py-2 sm:px-4",
        warning ? "bg-(--warn-soft) text-(--warn)" : "bg-(--surface-2) text-(--text-1)",
      )}
    >
      {warning ? <AlertIcon className="mt-1.5 h-4 w-4 shrink-0" /> : null}
      <p className="min-w-0 flex-1 py-0.5 break-words">
        {announcement.text}
        {href && announcement.link ? (
          <>
            {" "}
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={clsx(
                "inline-flex items-center gap-1 font-medium underline underline-offset-2",
                warning ? "text-(--warn)" : "text-(--accent)",
              )}
            >
              {announcement.link.label}
              {external ? <ExternalLinkIcon className="h-3.5 w-3.5" /> : null}
            </a>
          </>
        ) : null}
      </p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="ঘোষণাটি বন্ধ করুন"
          title="বন্ধ করুন"
          className="-me-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-80 transition hover:bg-current/10 hover:opacity-100"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      ) : null}
    </aside>
  );
}

export function AnnouncementBanner({
  announcement,
  compact = false,
}: {
  announcement: Announcement;
  compact?: boolean;
}) {
  const key = dismissalKey(`${announcement.tone}|${announcement.text}`);
  const dismissed = useSyncExternalStore(
    subscribe,
    () => dismissedInMemory === key || readDismissed() === key,
    () => true,
  );

  if (!announcement.enabled || announcement.text.trim().length === 0 || dismissed) return null;

  return (
    <AnnouncementView
      announcement={announcement}
      compact={compact}
      onDismiss={() => dismiss(key)}
    />
  );
}
