"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AskScholarDialog } from "@/components/help/AskScholarDialog";
import { HelpStatusBadge } from "@/components/help/HelpStatusBadge";
import {
  ChevronRightIcon,
  PlusIcon,
  QuestionIcon,
  RetryIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { HELP_CONFIG } from "@/config/site";
import { helpRequestStore, type StoredHelpRequest } from "@/lib/help/clientStore";
import type { HelpStatusItem } from "@/lib/help/types";
import { formatTimestamp } from "@/lib/utils/dateTime";

interface StatusState {
  key: string | null;
  version: number;
  items: Record<string, HelpStatusItem>;
  error: string | null;
}

const FALLBACK_ERROR = "প্রশ্নগুলোর অবস্থা এখন আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।";

const noopSubscribe = () => () => undefined;

function missingStatus(token: string): HelpStatusItem {
  return { token, found: false, status: null, updatedAt: null };
}

async function fetchStatuses(tokens: string[]): Promise<Pick<StatusState, "items" | "error">> {
  try {
    const response = await fetch("/api/help/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokens }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as {
      items?: HelpStatusItem[];
      error?: string;
    } | null;
    if (!response.ok || !body?.items) return { items: {}, error: body?.error ?? FALLBACK_ERROR };
    return {
      items: Object.fromEntries(body.items.map((item) => [item.token, item])),
      error: null,
    };
  } catch {
    return { items: {}, error: FALLBACK_ERROR };
  }
}

function RequestRow({
  entry,
  status,
  onRemove,
}: {
  entry: StoredHelpRequest;
  status: HelpStatusItem | undefined;
  onRemove: () => void;
}) {
  const badge = !status ? "loading" : status.found && status.status ? status.status : "missing";
  return (
    <li className="flex items-stretch gap-1 rounded-2xl border border-(--border) bg-(--bg) transition hover:border-(--border-strong)">
      <Link
        href={`${HELP_CONFIG.path}/${entry.token}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-s-2xl px-4 py-3.5 active:bg-(--surface-2)"
      >
        <div className="min-w-0 flex-1">
          <p dir="auto" className="line-clamp-2 text-[0.9375rem] leading-6 font-medium break-words">
            {entry.excerpt || "প্রশ্ন"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-(--text-3)">
            <HelpStatusBadge status={badge} />
            <span className="tabular-nums">{formatTimestamp(entry.createdAt)}</span>
          </div>
        </div>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-(--text-3)" />
      </Link>
      <button
        type="button"
        onClick={onRemove}
        className="flex w-11 shrink-0 items-center justify-center rounded-e-2xl text-(--text-3) transition hover:bg-(--surface-2) hover:text-(--danger)"
        aria-label="এই ব্রাউজারের তালিকা থেকে সরান"
        title="এই ব্রাউজারের তালিকা থেকে সরান"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </li>
  );
}

export function MyHelpRequests() {
  const stored = useSyncExternalStore(
    helpRequestStore.subscribe,
    helpRequestStore.getSnapshot,
    helpRequestStore.getServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [askOpen, setAskOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<StatusState>({
    key: null,
    version: -1,
    items: {},
    error: null,
  });

  const tokens = stored.map((entry) => entry.token);
  const needsFetch =
    tokens.length > 0 && (state.version !== version || tokens.some((token) => !state.items[token]));
  const key = needsFetch ? `${version}:${tokens.join("|")}` : null;
  const failed = key !== null && state.key === key && state.error !== null;
  const loading = key !== null && !failed;

  useEffect(() => {
    if (key === null) return;
    const separator = key.indexOf(":");
    let active = true;
    void fetchStatuses(key.slice(separator + 1).split("|")).then((result) => {
      if (!active) return;
      setState((previous) => ({
        key,
        version: Number(key.slice(0, separator)),
        items: result.error ? previous.items : result.items,
        error: result.error,
      }));
    });
    return () => {
      active = false;
    };
  }, [key]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            আমার প্রশ্নগুলো
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-(--text-3)">
            আলেমদের কাছে পাঠানো যে প্রশ্নগুলো এই ব্রাউজারে সংরক্ষিত আছে। অন্য ডিভাইস থেকে দেখতে
            ট্র্যাকিং লিংকটি সেখানে খুলুন।
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {tokens.length > 0 ? (
            <button
              type="button"
              onClick={() => setVersion((value) => value + 1)}
              disabled={loading}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-(--border) text-(--text-2) transition hover:bg-(--surface-2) disabled:opacity-60 sm:h-10 sm:w-10"
              aria-label="অবস্থা হালনাগাদ করুন"
              title="অবস্থা হালনাগাদ করুন"
            >
              <RetryIcon
                className={loading ? "h-4 w-4 animate-spin motion-reduce:animate-none" : "h-4 w-4"}
              />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setAskOpen(true)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast) transition hover:bg-(--accent-strong) sm:h-10 sm:flex-none"
          >
            <PlusIcon className="h-4 w-4" />
            নতুন প্রশ্ন পাঠান
          </button>
        </div>
      </div>

      {failed ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-(--danger)"
        >
          {state.error}
        </p>
      ) : null}

      {!hydrated ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-2xl bg-(--surface-2) motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : stored.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-(--border) px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--surface-2) text-(--text-3)">
            <QuestionIcon className="h-6 w-6" />
          </span>
          <p className="font-medium">এই ব্রাউজারে কোনো প্রশ্ন নেই</p>
          <p className="max-w-sm text-sm leading-6 text-(--text-3)">
            চ্যাটে যেকোনো উত্তরের নিচে &quot;আলেমের কাছে প্রশ্ন পাঠান&quot; চাপুন, অথবা এখান থেকে
            সরাসরি নতুন প্রশ্ন পাঠান।
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-busy={loading}>
          {stored.map((entry) => (
            <RequestRow
              key={entry.token}
              entry={entry}
              status={state.items[entry.token] ?? (failed ? missingStatus(entry.token) : undefined)}
              onRemove={() => helpRequestStore.remove(entry.token)}
            />
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs leading-5 text-(--text-3)">
        সর্বোচ্চ {HELP_CONFIG.maxStoredRequests.toLocaleString("bn-BD")}টি প্রশ্ন এই ব্রাউজারে মনে
        রাখা হয়। ব্রাউজারের ডেটা মুছে ফেললে তালিকাটিও মুছে যাবে, তবে লিংক থাকলে প্রশ্ন দেখা যাবে।
      </p>

      <AskScholarDialog open={askOpen} onClose={() => setAskOpen(false)} />
    </>
  );
}
