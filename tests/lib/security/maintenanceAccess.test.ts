import { afterEach, describe, expect, it } from "vitest";
import { SITE_URL_CONFIG } from "@/config/site";
import { maintenanceAccess } from "@/lib/security/maintenanceAccess";
import { setStoredSiteUrl, siteUrl } from "@/lib/utils/siteUrl";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

function request(headers: Record<string, string>) {
  return new Request("https://usul.example/api/maintenance", { headers });
}

describe("maintenanceAccess", () => {
  it("accepts the Vercel cron bearer when CRON_SECRET is configured", () => {
    process.env.CRON_SECRET = "a-long-cron-secret-value";
    expect(maintenanceAccess(request({ authorization: "Bearer a-long-cron-secret-value" }))).toBe(
      "secret",
    );
    expect(maintenanceAccess(request({ "user-agent": "vercel-cron/1.0" }))).toBe("denied");
  });

  it("lets the Vercel cron in without any secret configured, as a rate-limited caller", () => {
    delete process.env.CRON_SECRET;
    expect(maintenanceAccess(request({ "user-agent": "vercel-cron/1.0" }))).toBe("vercel-cron");
    expect(maintenanceAccess(request({ "user-agent": "curl/8" }))).toBe("denied");
  });

  it("accepts the ingest secret header", () => {
    process.env.INGEST_API_SECRET = "ingest";
    expect(maintenanceAccess(request({ "x-ingest-secret": "ingest" }))).toBe("secret");
  });
});

describe("siteUrl", () => {
  afterEach(() => setStoredSiteUrl(null));

  it("takes the development override before the stored domain", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://usul.ai";
    setStoredSiteUrl("https://usulai.com");

    expect(siteUrl()).toBe("https://usul.ai");
  });

  it("ignores the hosting platform's own variables", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "usul-ai.vercel.app";
    setStoredSiteUrl(null);

    expect(siteUrl()).toBe(SITE_URL_CONFIG.fallbackUrl);
  });

  it("uses the stored domain when there is no development override", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    setStoredSiteUrl("https://usulai.com");

    expect(siteUrl()).toBe("https://usulai.com");
  });
});
