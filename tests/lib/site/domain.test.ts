import { afterEach, describe, expect, it } from "vitest";
import { SITE_URL_CONFIG } from "@/config/site";
import { mergeDomainSettings, normalizeDomainUrl } from "@/lib/site/contentShape";
import {
  effectiveSiteUrl,
  fallbackSiteUrl,
  setStoredSiteUrl,
  siteUrl,
} from "@/lib/utils/siteUrl";

describe("domain validation", () => {
  it("accepts a bare domain and gives it https", () => {
    expect(normalizeDomainUrl("usulai.com")).toBe("https://usulai.com");
    expect(normalizeDomainUrl("  Usulai.COM  ")).toBe("https://usulai.com");
    expect(normalizeDomainUrl("https://usulai.com/")).toBe("https://usulai.com");
    expect(normalizeDomainUrl("https://ask.usulai.com")).toBe("https://ask.usulai.com");
  });

  it("refuses anything that is not a plain https origin", () => {
    for (const value of [
      "",
      "   ",
      "usulai",
      "usulai.c",
      "http://usulai.com",
      "https://usulai.com/masail",
      "https://usulai.com?ref=1",
      "https://usulai.com#top",
      "https://admin:secret@usulai.com",
      "javascript:alert(1)",
      "ftp://usulai.com",
      "192.168.0.1",
      `https://${"a".repeat(300)}.com`,
    ]) {
      expect(normalizeDomainUrl(value), value).toBeNull();
    }
  });

  it("keeps localhost usable for development", () => {
    expect(normalizeDomainUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("reads a stored value defensively", () => {
    expect(mergeDomainSettings(null)).toEqual({ url: "" });
    expect(mergeDomainSettings({ url: "  " })).toEqual({ url: "" });
    expect(mergeDomainSettings({ url: "usulai.com" })).toEqual({ url: "https://usulai.com" });
    expect(mergeDomainSettings({ url: "https://usulai.com/path" })).toEqual({ url: "" });
  });
});

describe("site url resolution", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    setStoredSiteUrl(null);
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("uses the admin domain once one is stored", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    setStoredSiteUrl("https://usulai.com/");

    expect(siteUrl()).toBe("https://usulai.com");
  });

  it("always falls back to the deployed site when no domain is stored", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    setStoredSiteUrl(null);

    expect(siteUrl()).toBe(SITE_URL_CONFIG.fallbackUrl);
    expect(effectiveSiteUrl("")).toBe(SITE_URL_CONFIG.fallbackUrl);
  });

  it("never lets an environment variable become the fallback", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    setStoredSiteUrl(null);

    expect(fallbackSiteUrl()).toBe(SITE_URL_CONFIG.fallbackUrl);
  });

  it("keeps the deployed fallback pointing at a real origin", () => {
    expect(() => new URL(SITE_URL_CONFIG.fallbackUrl)).not.toThrow();
    expect(SITE_URL_CONFIG.fallbackUrl.endsWith("/")).toBe(false);
  });
});
