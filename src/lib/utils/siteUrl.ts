import { SITE_URL_CONFIG } from "@/config/site";

let storedDomain: string | null = null;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function developmentOverride(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const local = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return local ? trimTrailingSlash(local) : null;
}

export function setStoredSiteUrl(url: string | null): void {
  storedDomain = url ? trimTrailingSlash(url) : null;
}

export function fallbackSiteUrl(): string {
  return SITE_URL_CONFIG.fallbackUrl;
}

export function effectiveSiteUrl(stored: string | null): string {
  return developmentOverride() ?? (stored ? trimTrailingSlash(stored) : SITE_URL_CONFIG.fallbackUrl);
}

export function siteUrl(): string {
  return effectiveSiteUrl(storedDomain);
}
