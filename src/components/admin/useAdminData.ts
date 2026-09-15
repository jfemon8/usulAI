"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";

interface DataState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  key: string | null;
}

export function useAdminData<T>(path: string | null) {
  const [state, setState] = useState<DataState<T>>({
    data: null,
    error: null,
    loading: path !== null,
    key: path,
  });
  const [version, setVersion] = useState(0);

  if (state.key !== path) {
    setState((current) => ({ ...current, key: path, loading: path !== null, error: null }));
  }

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    adminApi<T>(path, { signal: controller.signal }).then(
      (data) => setState({ data, error: null, loading: false, key: path }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, error: errorMessage(error), loading: false }));
      },
    );
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setVersion((value) => value + 1);
  }, []);

  const replace = useCallback((data: T) => {
    setState((current) => ({ ...current, data }));
  }, []);

  return { data: state.data, error: state.error, loading: state.loading, reload, replace };
}
