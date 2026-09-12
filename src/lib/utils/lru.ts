export interface Lru<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  stats(): { size: number; hits: number };
}

export function createLru<T>(limit: number): Lru<T> {
  const entries = new Map<string, T>();
  let hits = 0;

  return {
    get(key) {
      const value = entries.get(key);
      if (value === undefined) return undefined;

      entries.delete(key);
      entries.set(key, value);
      hits += 1;

      return value;
    },
    set(key, value) {
      entries.set(key, value);

      while (entries.size > limit) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    stats() {
      return { size: entries.size, hits };
    },
  };
}

export function normalizeCacheKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
