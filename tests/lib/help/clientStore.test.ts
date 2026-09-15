import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HELP_CONFIG } from "@/config/site";

const token = (seed: string) => seed.repeat(43).slice(0, 43);

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("stored help request helpers", () => {
  it("drops malformed entries, duplicates and bad dates, newest first", async () => {
    const { normalizeStoredRequests } = await import("@/lib/help/clientStore");
    const items = normalizeStoredRequests([
      { token: token("a"), excerpt: "পুরোনো", createdAt: "2026-09-01T00:00:00.000Z" },
      { token: token("b"), excerpt: "নতুন", createdAt: "2026-09-10T00:00:00.000Z" },
      { token: token("a"), excerpt: "আবার", createdAt: "2026-09-12T00:00:00.000Z" },
      { token: "short", excerpt: "x", createdAt: "2026-09-12T00:00:00.000Z" },
      { token: token("c"), excerpt: "x", createdAt: "not a date" },
      null,
      "text",
    ]);
    expect(items.map((item) => item.token)).toEqual([token("b"), token("a")]);
    expect(normalizeStoredRequests({})).toEqual([]);
  });

  it("caps the list and moves a re-added entry to the front", async () => {
    const { withStoredRequest } = await import("@/lib/help/clientStore");
    const base = [
      { token: token("a"), excerpt: "a", createdAt: "2026-09-01T00:00:00.000Z" },
      { token: token("b"), excerpt: "b", createdAt: "2026-09-02T00:00:00.000Z" },
    ];
    const next = withStoredRequest(
      base,
      { token: token("c"), excerpt: "c", createdAt: "2026-09-03T00:00:00.000Z" },
      2,
    );
    expect(next.map((item) => item.token)).toEqual([token("c"), token("b")]);
  });
});

describe("helpRequestStore", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {
      localStorage: new MemoryStorage(),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds, remembers without duplicating and removes, notifying subscribers", async () => {
    const { helpRequestStore } = await import("@/lib/help/clientStore");
    const listener = vi.fn();
    const unsubscribe = helpRequestStore.subscribe(listener);
    const createdAt = "2026-09-15T10:00:00.000Z";

    helpRequestStore.add({ token: token("a"), excerpt: "নামাজ", createdAt });
    const first = helpRequestStore.getSnapshot();
    expect(first).toHaveLength(1);
    expect(helpRequestStore.getSnapshot()).toBe(first);

    helpRequestStore.remember(`r.66e6a1b2c3d4e5f60718293a.${token("s")}`, "নামাজ", createdAt);
    expect(helpRequestStore.getSnapshot()).toHaveLength(1);

    helpRequestStore.remove(token("a"));
    expect(helpRequestStore.getSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("survives storage that throws", async () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    const { helpRequestStore } = await import("@/lib/help/clientStore");
    expect(() =>
      helpRequestStore.add({
        token: token("a"),
        excerpt: "x",
        createdAt: new Date().toISOString(),
      }),
    ).not.toThrow();
    expect(helpRequestStore.getSnapshot()).toEqual([]);
    expect(HELP_CONFIG.storageKey).toContain("help");
  });
});
