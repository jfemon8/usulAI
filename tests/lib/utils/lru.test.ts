import { describe, expect, it } from "vitest";
import { createLru, normalizeCacheKey } from "@/lib/utils/lru";

describe("createLru", () => {
  it("returns what was stored", () => {
    const cache = createLru<number>(2);
    cache.set("a", 1);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("evicts the least recently used entry past the limit", () => {
    const cache = createLru<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("a read makes an entry recent again", () => {
    const cache = createLru<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
  });

  it("counts hits but not misses", () => {
    const cache = createLru<number>(2);
    cache.set("a", 1);
    cache.get("a");
    cache.get("a");
    cache.get("b");

    expect(cache.stats()).toEqual({ size: 1, hits: 2 });
  });
});

describe("normalizeCacheKey", () => {
  it("collapses case and whitespace so equivalent questions share a key", () => {
    expect(normalizeCacheKey("  Zakater   NISAB\nkoto ")).toBe("zakater nisab koto");
  });

  it("keeps distinct questions distinct", () => {
    expect(normalizeCacheKey("নামাজ কেন ফরজ")).not.toBe(normalizeCacheKey("হজ কার উপর ফরজ"));
  });
});
