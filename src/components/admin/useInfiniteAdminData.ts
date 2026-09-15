"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";

interface InfiniteOptions<TPage, TItem> {
  key: string | null;
  path: (cursor: string | null) => string;
  items: (page: TPage) => TItem[];
  next: (page: TPage) => string | null;
}

interface InfiniteState<TPage> {
  key: string | null;
  pages: TPage[];
  nextCursor: string | null;
  done: boolean;
  pending: { cursor: string | null } | null;
  error: string | null;
  version: number;
}

function initialState<TPage>(key: string | null, version = 0): InfiniteState<TPage> {
  return {
    key,
    pages: [],
    nextCursor: null,
    done: false,
    pending: key === null ? null : { cursor: null },
    error: null,
    version,
  };
}

export function useInfiniteAdminData<TPage, TItem>(options: InfiniteOptions<TPage, TItem>) {
  const [state, setState] = useState<InfiniteState<TPage>>(() => initialState(options.key));
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  if (state.key !== options.key) {
    setState(initialState(options.key, state.version + 1));
  }

  const pending = state.pending;
  const version = state.version;
  const key = state.key;

  useEffect(() => {
    if (!pending || key === null) return;
    const controller = new AbortController();
    const current = optionsRef.current;
    adminApi<TPage>(current.path(pending.cursor), { signal: controller.signal }).then(
      (page) => {
        const nextCursor = optionsRef.current.next(page);
        setState((previous) =>
          previous.version !== version || previous.key !== key
            ? previous
            : {
                ...previous,
                pages: [...previous.pages, page],
                nextCursor,
                done: nextCursor === null,
                pending: null,
                error: null,
              },
        );
      },
      (failure: unknown) => {
        if (controller.signal.aborted) return;
        setState((previous) =>
          previous.version !== version || previous.key !== key
            ? previous
            : { ...previous, pending: null, error: errorMessage(failure) },
        );
      },
    );
    return () => controller.abort();
  }, [pending, version, key]);

  const loadMore = useCallback(() => {
    setState((previous) =>
      previous.done || previous.pending || previous.error || previous.pages.length === 0
        ? previous
        : { ...previous, pending: { cursor: previous.nextCursor } },
    );
  }, []);

  const retry = useCallback(() => {
    setState((previous) =>
      previous.pending
        ? previous
        : {
            ...previous,
            error: null,
            pending: { cursor: previous.pages.length === 0 ? null : previous.nextCursor },
          },
    );
  }, []);

  const reload = useCallback(() => {
    setState((previous) => initialState(previous.key, previous.version + 1));
  }, []);

  const setPages = useCallback((update: (pages: TPage[]) => TPage[]) => {
    setState((previous) => ({ ...previous, pages: update(previous.pages) }));
  }, []);

  const items = state.pages.flatMap((page) => options.items(page));

  return {
    items,
    pages: state.pages,
    firstPage: state.pages[0] ?? null,
    error: state.error,
    loading: state.pending !== null && state.pages.length === 0,
    loadingMore: state.pending !== null && state.pages.length > 0,
    hasMore: !state.done,
    loadMore,
    retry,
    reload,
    setPages,
  };
}
