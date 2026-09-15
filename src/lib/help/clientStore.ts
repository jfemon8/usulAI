import { HELP_CONFIG } from "@/config/site";

export interface StoredHelpRequest {
  token: string;
  excerpt: string;
  createdAt: string;
}

const EXCERPT_CHARS = 140;
const TOKEN_PATTERN = /^(?:[A-Za-z0-9_-]{43}|r\.[0-9a-f]{24}\.[A-Za-z0-9_-]{43})$/;
const EMPTY: StoredHelpRequest[] = [];

export function helpExcerpt(text: string): string {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > EXCERPT_CHARS ? `${plain.slice(0, EXCERPT_CHARS).trimEnd()}…` : plain;
}

export function isStoredToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function normalizeStoredRequests(
  value: unknown,
  max: number = HELP_CONFIG.maxStoredRequests,
): StoredHelpRequest[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: StoredHelpRequest[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { token, excerpt, createdAt } = entry as Record<string, unknown>;
    if (typeof token !== "string" || !isStoredToken(token) || seen.has(token)) continue;
    const date = typeof createdAt === "string" ? new Date(createdAt) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    seen.add(token);
    items.push({
      token,
      excerpt: typeof excerpt === "string" ? helpExcerpt(excerpt) : "",
      createdAt: date.toISOString(),
    });
  }
  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, max);
}

export function withStoredRequest(
  items: readonly StoredHelpRequest[],
  entry: StoredHelpRequest,
  max: number = HELP_CONFIG.maxStoredRequests,
): StoredHelpRequest[] {
  return normalizeStoredRequests(
    [entry, ...items.filter((item) => item.token !== entry.token)],
    max,
  );
}

let cache: { raw: string | null; items: StoredHelpRequest[] } | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return storage()?.getItem(HELP_CONFIG.storageKey) ?? null;
  } catch {
    return null;
  }
}

function snapshot(): StoredHelpRequest[] {
  const raw = readRaw();
  if (cache && cache.raw === raw) return cache.items;
  let items = EMPTY;
  if (raw) {
    try {
      items = normalizeStoredRequests(JSON.parse(raw));
    } catch {
      items = EMPTY;
    }
  }
  cache = { raw, items };
  return items;
}

function write(items: StoredHelpRequest[]): void {
  try {
    const store = storage();
    if (!store) return;
    if (items.length === 0) store.removeItem(HELP_CONFIG.storageKey);
    else store.setItem(HELP_CONFIG.storageKey, JSON.stringify(items));
  } catch {
    return;
  }
  cache = null;
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== HELP_CONFIG.storageKey) return;
  cache = null;
  for (const listener of listeners) listener();
}

export const helpRequestStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (listeners.size === 1 && typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  },
  getSnapshot: snapshot,
  getServerSnapshot: (): StoredHelpRequest[] => EMPTY,
  add(entry: StoredHelpRequest): void {
    write(withStoredRequest(snapshot(), entry));
  },
  remember(token: string, question: string, createdAt: string): void {
    const items = snapshot();
    const excerpt = helpExcerpt(question);
    const known = items.some(
      (item) => item.token === token || (item.createdAt === createdAt && item.excerpt === excerpt),
    );
    if (!known) write(withStoredRequest(items, { token, excerpt, createdAt }));
  },
  remove(token: string): void {
    write(snapshot().filter((item) => item.token !== token));
  },
};
