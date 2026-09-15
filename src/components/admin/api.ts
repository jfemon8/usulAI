"use client";

import { ADMIN_CONFIG } from "@/config/site";

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const NETWORK_ERROR = "সার্ভারে পৌঁছানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।";

export async function adminApi<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminApiError(NETWORK_ERROR, 0);
  }

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (response.status === 401 && !path.startsWith("/api/admin/auth/")) {
    window.location.assign(ADMIN_CONFIG.paths.login);
  }

  if (!response.ok || payload === null) {
    throw new AdminApiError(
      payload?.error ?? `অনুরোধ ব্যর্থ হয়েছে (${response.status})।`,
      response.status,
    );
  }
  return payload;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "অজানা সমস্যা হয়েছে।";
}
