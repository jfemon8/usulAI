import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_CONFIG } from "@/config/site";
import {
  adminCacheKeys,
  clearAdminCache,
  dropAdminCache,
  readAdminCache,
  writeAdminCache,
} from "@/components/admin/cache";

describe("admin client cache", () => {
  beforeEach(() => {
    clearAdminCache();
    vi.useRealTimers();
  });

  it("returns what was written, with its age", () => {
    writeAdminCache("/api/admin/topics", { items: [1, 2] });

    const cached = readAdminCache<{ items: number[] }>(
      "/api/admin/topics",
      ADMIN_CONFIG.clientCache.dataMs,
    );

    expect(cached?.data.items).toEqual([1, 2]);
    expect(cached?.age).toBeGreaterThanOrEqual(0);
  });

  it("ignores and forgets an entry older than the window", () => {
    vi.useFakeTimers();
    writeAdminCache("/api/admin/staff", { items: [] });
    vi.advanceTimersByTime(ADMIN_CONFIG.clientCache.dataMs + 1);

    expect(readAdminCache("/api/admin/staff", ADMIN_CONFIG.clientCache.dataMs)).toBeNull();
    expect(adminCacheKeys()).not.toContain("/api/admin/staff");
  });

  it("treats a null key as no cache", () => {
    writeAdminCache(null, { items: [] });

    expect(readAdminCache(null, ADMIN_CONFIG.clientCache.dataMs)).toBeNull();
    expect(adminCacheKeys()).toHaveLength(0);
  });

  it("drops the oldest write once it is full", () => {
    const limit = ADMIN_CONFIG.clientCache.maxEntries;
    for (let index = 0; index <= limit; index += 1) writeAdminCache(`/api/admin/${index}`, index);

    expect(adminCacheKeys()).toHaveLength(limit);
    expect(readAdminCache("/api/admin/0", ADMIN_CONFIG.clientCache.dataMs)).toBeNull();
    expect(readAdminCache(`/api/admin/${limit}`, ADMIN_CONFIG.clientCache.dataMs)?.data).toBe(limit);
  });

  it("re-writing a key keeps it from being evicted first", () => {
    writeAdminCache("/api/admin/first", "a");
    writeAdminCache("/api/admin/second", "b");
    writeAdminCache("/api/admin/first", "c");

    expect(adminCacheKeys()).toEqual(["/api/admin/second", "/api/admin/first"]);
  });

  it("drops one key or every key", () => {
    writeAdminCache("/api/admin/one", 1);
    writeAdminCache("/api/admin/two", 2);

    dropAdminCache("/api/admin/one");
    expect(adminCacheKeys()).toEqual(["/api/admin/two"]);

    clearAdminCache();
    expect(adminCacheKeys()).toHaveLength(0);
  });
});
