"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authorLabel, publishedLabel } from "@/components/masail/MasailChrome";
import { CloseIcon, RetryIcon, SearchIcon } from "@/components/ui/Icons";
import { HELP_CONFIG, MASAIL_CONFIG } from "@/config/site";
import type { MasalaSummary } from "@/lib/analytics/verifiedAnswers";

interface FeedState {
  query: string;
  items: MasalaSummary[];
  cursor: string | null;
  status: "idle" | "loading" | "error";
  error: string | null;
  searched: boolean;
}

const SEARCH_DELAY_MS = 350;
const numbers = new Intl.NumberFormat("bn-BD");

function MasalaCard({ item }: { item: MasalaSummary }) {
  const author = authorLabel(item.author);
  const published = publishedLabel(item.publishedAt);
  return (
    <li className="[contain-intrinsic-size:auto_9rem] [content-visibility:auto]">
      <Link
        href={item.path}
        className="block rounded-2xl border border-(--border) bg-(--bg) px-4 py-4 transition hover:border-(--border-strong) hover:bg-(--sidebar-bg) focus-visible:ring-2 focus-visible:ring-(--accent-ring) focus-visible:outline-none active:scale-[0.995] sm:px-5"
      >
        <h2 className="text-base leading-7 font-semibold text-balance break-words text-(--text-1)">
          {item.question}
        </h2>
        {item.excerpt ? (
          <p className="mt-1.5 line-clamp-3 text-sm leading-6 break-words text-(--text-2)">
            {item.excerpt}
          </p>
        ) : null}
        {author || published ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--text-3)">
            {author ? <span className="font-medium text-(--accent)">{author}</span> : null}
            {author && published ? <span aria-hidden="true">·</span> : null}
            {published && item.publishedAt ? (
              <time dateTime={item.publishedAt}>{published}</time>
            ) : null}
          </p>
        ) : null}
      </Link>
    </li>
  );
}

export function MasailFeed({
  initialItems,
  initialCursor,
  unavailable,
}: {
  initialItems: MasalaSummary[];
  initialCursor: string | null;
  unavailable: boolean;
}) {
  const [state, setState] = useState<FeedState>({
    query: "",
    items: initialItems,
    cursor: initialCursor,
    status: unavailable ? "error" : "idle",
    error: unavailable ? "এখন মাসআলা আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।" : null,
    searched: false,
  });
  const [input, setInput] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef<{
    state: FeedState;
    load: (query: string, cursor: string | null) => void;
  } | null>(null);

  function load(query: string, cursor: string | null) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({
      ...previous,
      query,
      status: "loading",
      error: null,
      ...(cursor === null ? { items: [], cursor: null } : {}),
    }));

    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (cursor) params.set("cursor", cursor);

    const search = params.toString();
    fetch(`/api/masail${search ? `?${search}` : ""}`, {
      signal: current.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          items?: MasalaSummary[];
          nextCursor?: string | null;
          error?: string;
        } | null;
        if (!response.ok || !body?.items) {
          throw new Error(body?.error ?? "মাসআলা আনা যায়নি। আবার চেষ্টা করুন।");
        }
        return { items: body.items, nextCursor: body.nextCursor ?? null };
      })
      .then(
        (page) => {
          if (current.signal.aborted) return;
          setState((previous) => {
            const known = new Set(cursor === null ? [] : previous.items.map((item) => item.id));
            return {
              ...previous,
              items: [
                ...(cursor === null ? [] : previous.items),
                ...page.items.filter((item) => !known.has(item.id)),
              ],
              cursor: page.nextCursor,
              status: "idle",
              error: null,
              searched: query.length > 0,
            };
          });
        },
        (error: unknown) => {
          if (current.signal.aborted) return;
          setState((previous) => ({
            ...previous,
            status: "error",
            error:
              error instanceof Error && error.name !== "TypeError"
                ? error.message
                : "সার্ভারে পৌঁছানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।",
          }));
        },
      );
  }

  useEffect(() => {
    latest.current = { state, load };
  });

  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || !latest.current) return;
        const { state: current, load: next } = latest.current;
        if (current.status !== "idle" || !current.cursor) return;
        next(current.query, current.cursor);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [state.status, state.cursor]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  function search(value: string) {
    setInput(value);
    clearTimeout(timer.current);
    const query = value.trim().slice(0, MASAIL_CONFIG.maxSearchChars);
    if (!query) {
      controller.current?.abort();
      setState({
        query: "",
        items: initialItems,
        cursor: initialCursor,
        status: "idle",
        error: null,
        searched: false,
      });
      return;
    }
    timer.current = setTimeout(() => load(query, null), SEARCH_DELAY_MS);
  }

  function retry() {
    const reload = state.items.length === 0 || state.query !== input.trim();
    load(input.trim().slice(0, MASAIL_CONFIG.maxSearchChars), reload ? null : state.cursor);
  }

  const loading = state.status === "loading";
  const empty = state.items.length === 0 && state.status === "idle";

  return (
    <div>
      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          clearTimeout(timer.current);
          const query = input.trim().slice(0, MASAIL_CONFIG.maxSearchChars);
          if (query) load(query, null);
        }}
      >
        <label htmlFor="masail-search" className="sr-only">
          মাসআলা খুঁজুন
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-(--text-3)"
        />
        <input
          id="masail-search"
          type="search"
          value={input}
          maxLength={MASAIL_CONFIG.maxSearchChars}
          onChange={(event) => search(event.target.value)}
          placeholder="প্রশ্নের শব্দ লিখে খুঁজুন"
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full rounded-2xl border border-(--border) bg-(--bg) ps-10 pe-11 text-base text-(--text-1) transition outline-none placeholder:text-(--text-3) focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft) [&::-webkit-search-cancel-button]:hidden"
        />
        {input ? (
          <button
            type="button"
            aria-label="খোঁজা মুছুন"
            onClick={() => search("")}
            className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-(--text-3) transition hover:bg-(--surface-2) hover:text-(--text-1)"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      <p className="mt-3 min-h-5 text-xs text-(--text-3)" role="status" aria-live="polite">
        {loading && state.items.length === 0
          ? "খোঁজা হচ্ছে…"
          : state.searched && state.status === "idle"
            ? `"${state.query}" খুঁজে ${numbers.format(state.items.length)}${state.cursor ? "+" : ""}টি মাসআলা পাওয়া গেছে`
            : ""}
      </p>

      {state.items.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-3">
          {state.items.map((item) => (
            <MasalaCard key={item.id} item={item} />
          ))}
        </ul>
      ) : null}

      {loading && state.items.length === 0 ? (
        <div className="mt-2 flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl bg-(--surface-2) motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : null}

      {empty ? (
        <div className="mt-4 rounded-2xl border border-dashed border-(--border-strong) px-5 py-10 text-center">
          <p className="text-base font-medium text-(--text-1)">
            {state.searched
              ? "এই শব্দে কোনো মাসআলা পাওয়া যায়নি"
              : "এখনো কোনো মাসআলা প্রকাশিত হয়নি"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-(--text-2)">
            {state.searched
              ? "অন্য শব্দে খুঁজে দেখুন, অথবা আপনার প্রশ্ন আলেমের কাছে পাঠান।"
              : "আলেমরা উত্তর প্রকাশ করলে এখানে দেখা যাবে। ততক্ষণ আপনার প্রশ্ন আলেমের কাছে পাঠাতে পারেন।"}
          </p>
          <Link
            href={HELP_CONFIG.path}
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast) transition hover:bg-(--accent-strong)"
          >
            আলেমের কাছে প্রশ্ন পাঠান
          </Link>
        </div>
      ) : null}

      {state.status === "error" && state.error ? (
        <div
          role="alert"
          className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-(--danger-soft) px-4 py-5 text-center text-sm text-(--danger)"
        >
          <p>{state.error}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-(--border) bg-(--bg) px-3 text-sm text-(--text-1) transition hover:bg-(--surface-2)"
          >
            <RetryIcon className="h-4 w-4" />
            আবার চেষ্টা করুন
          </button>
        </div>
      ) : null}

      {loading && state.items.length > 0 ? (
        <p className="py-5 text-center text-sm text-(--text-3)" role="status">
          আরও মাসআলা আসছে…
        </p>
      ) : null}
      {state.status === "idle" && !state.cursor && state.items.length > 0 ? (
        <p className="py-5 text-center text-xs text-(--text-3)">সব মাসআলা দেখানো হয়েছে</p>
      ) : null}

      <div ref={sentinel} aria-hidden="true" className="h-px" />
    </div>
  );
}
