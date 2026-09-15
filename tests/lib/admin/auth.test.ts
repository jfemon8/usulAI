import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn(() => Promise.reject(new Error("no db"))) }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { hashPassword, passwordProblem, verifyPassword } = await import("@/lib/admin/password");
const { isAdminEmail, normalizeEmail, tokenDigest } = await import("@/lib/admin/accounts");
const { isSameOrigin } = await import("@/lib/admin/http");
const { commandSuggestions, matchCommand } = await import("@/lib/chat/commands");

describe("admin passwords", () => {
  it("hashes with a random salt and verifies only the right password", async () => {
    const first = await hashPassword("দীর্ঘ পাসওয়ার্ড 123");
    const second = await hashPassword("দীর্ঘ পাসওয়ার্ড 123");

    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("দীর্ঘ পাসওয়ার্ড 123", first)).toBe(true);
    expect(await verifyPassword("দীর্ঘ পাসওয়ার্ড 124", first)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "plain-text")).toBe(false);
  });

  it("explains why a new password is not acceptable", () => {
    expect(passwordProblem("short", "short")).toBe("short");
    expect(passwordProblem("long enough", "long enougH")).toBe("mismatch");
    expect(passwordProblem("same password", "same password", "same password")).toBe("same");
    expect(passwordProblem("a new password", "a new password", "old password")).toBeNull();
  });
});

describe("admin accounts", () => {
  it("accepts only the hardcoded admin emails, in any case", () => {
    expect(isAdminEmail(" JFEMON8@gmail.com ")).toBe(true);
    expect(isAdminEmail("emon.usulai@gmail.com")).toBe(true);
    expect(isAdminEmail("someone@gmail.com")).toBe(false);
    expect(normalizeEmail("  Emon.UsulAI@Gmail.com")).toBe("emon.usulai@gmail.com");
  });

  it("stores tokens only as digests", () => {
    expect(tokenDigest("token")).toBe(tokenDigest("token"));
    expect(tokenDigest("token")).not.toContain("token");
  });
});

describe("admin request origin", () => {
  const request = (method: string, headers: Record<string, string>) =>
    new Request("https://usul.example/api/admin/x", { method, headers });

  it("allows reads and same-site writes, and refuses cross-site writes", () => {
    expect(isSameOrigin(request("GET", {}))).toBe(true);
    expect(isSameOrigin(request("POST", { "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(request("POST", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(
      isSameOrigin(request("DELETE", { origin: "https://usul.example", host: "usul.example" })),
    ).toBe(true);
    expect(
      isSameOrigin(request("PUT", { origin: "https://evil.example", host: "usul.example" })),
    ).toBe(false);
    expect(isSameOrigin(request("POST", {}))).toBe(false);
  });
});

describe("chat commands", () => {
  it("matches whole commands and suggests by prefix", () => {
    expect(matchCommand(" /ADMIN ")).toBe("/admin");
    expect(matchCommand("/usage")).toBe("/usage");
    expect(matchCommand("/admin please")).toBeNull();
    expect(commandSuggestions("/").map((entry) => entry.command)).toEqual(["/usage", "/admin"]);
    expect(commandSuggestions("/ad").map((entry) => entry.command)).toEqual(["/admin"]);
    expect(commandSuggestions("admin")).toEqual([]);
  });
});
