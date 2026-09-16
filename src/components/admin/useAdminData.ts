"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { dropAdminCache, readAdminCache, writeAdminCache } from "@/components/admin/cache";
import { ADMIN_CONFIG } from "@/config/site";

interface DataState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  key: string | null;
}

function fromCache<T>(path: string | null): DataState<T> {
  const cached = readAdminCache<T>(path, ADMIN_CONFIG.clientCache.dataMs);
  return {
    data: cached?.data ?? null,
    error: null,
    loading: path !== null && !cached,
    key: path,
  };
}

export function useAdminData<T>(path: string | null) {
  const [state, setState] = useState<DataState<T>>(() => fromCache<T>(path));
  const [version, setVersion] = useState(0);

  if (state.key !== path) setState(fromCache<T>(path));

  useEffect(() => {
    if (path === null) return;
    if (readAdminCache<T>(path, ADMIN_CONFIG.clientCache.freshMs)) return;

    const controller = new AbortController();
    adminApi<T>(path, { signal: controller.signal }).then(
      (data) => {
        writeAdminCache(path, data);
        setState({ data, error: null, loading: false, key: path });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, error: errorMessage(error), loading: false }));
      },
    );
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => {
    dropAdminCache(path);
    setState((current) => ({ ...current, loading: true, error: null }));
    setVersion((value) => value + 1);
  }, [path]);

  const replace = useCallback(
    (data: T) => {
      writeAdminCache(path, data);
      setState((current) => ({ ...current, data, error: null }));
    },
    [path],
  );

  return { data: state.data, error: state.error, loading: state.loading, reload, replace };
}
