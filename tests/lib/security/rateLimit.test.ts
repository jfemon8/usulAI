import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn() }));

const { clientAddress, clientKey, decide, windowIndex } = await import("@/lib/security/rateLimit");
const { readableChatError, GENERIC_CHAT_ERROR } = await import("@/lib/utils/chatError");

const MINUTE = 60_000;

describe("decide", () => {
  const now = 1_789_000_000_000;
  const minute = windowIndex(now, "minute");

  it("allows a client that is within every window", () => {
    expect(decide({ minute: { w: minute, c: 5 } }, { minute: 5 }, now)).toEqual({ allowed: true });
  });

  it("blocks the request that goes over a window and says when it resets", () => {
    const decision = decide({ minute: { w: minute, c: 6 } }, { minute: 5 }, now);

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.window).toBe("minute");
      expect(decision.retryAfterSeconds).toBeGreaterThan(0);
      expect(decision.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("ignores a stale counter from an earlier window", () => {
    expect(decide({ minute: { w: minute - 1, c: 99 } }, { minute: 5 }, now + MINUTE).allowed).toBe(
      true,
    );
  });

  it("checks the longer windows too", () => {
    const day = windowIndex(now, "day");
    const decision = decide(
      { minute: { w: minute, c: 1 }, day: { w: day, c: 101 } },
      { minute: 5, day: 100 },
      now,
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.window).toBe("day");
  });
});

describe("client identity", () => {
  const request = (headers: Record<string, string>) =>
    new Request("http://localhost/api/chat", { headers });

  it("prefers the platform's real IP, then the first forwarded address", () => {
    expect(clientAddress(request({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe(
      "1.2.3.4",
    );
    expect(clientAddress(request({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
  });

  it("stores a hash, never the address itself", () => {
    const key = clientKey(request({ "x-real-ip": "1.2.3.4" }));

    expect(key).toMatch(/^[0-9a-f]{24}$/);
    expect(key).not.toContain("1.2.3.4");
    expect(clientKey(request({ "x-real-ip": "1.2.3.5" }))).not.toBe(key);
  });
});

describe("readableChatError", () => {
  it("shows the server's Bangla message from a JSON error body", () => {
    const error = new Error(
      JSON.stringify({ error: "অনুগ্রহ করে ৩০ সেকেন্ড পর আবার চেষ্টা করুন।" }),
    );
    expect(readableChatError(error)).toBe("অনুগ্রহ করে ৩০ সেকেন্ড পর আবার চেষ্টা করুন।");
  });

  it("falls back to a generic Bangla message for anything else", () => {
    expect(readableChatError(new Error("Failed to fetch"))).toBe(GENERIC_CHAT_ERROR);
    expect(readableChatError(undefined)).toBeNull();
  });
});
