"use client";

import { ADMIN_CONFIG } from "@/config/site";

interface CacheEntry {
  data: unknown;
  at: number;
}

const entries = new Map<string, CacheEntry>();

export function readAdminCache<T>(key: string | null, maxAgeMs: number): { data: T; age: number } | null {
  if (key === null) return null;

  const entry = entries.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.at;
  if (age > maxAgeMs) {
    entries.delete(key);
    return null;
  }

  return { data: entry.data as T, age };
}

export function writeAdminCache(key: string | null, data: unknown): void {
  if (key === null) return;

  entries.delete(key);
  entries.set(key, { data, at: Date.now() });

  while (entries.size > ADMIN_CONFIG.clientCache.maxEntries) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

export function dropAdminCache(key: string | null): void {
  if (key !== null) entries.delete(key);
}

export function clearAdminCache(): void {
  entries.clear();
}

export function adminCacheKeys(): string[] {
  return [...entries.keys()];
}
