import { EMAIL_CONFIG, SITE_NAME } from "@/config/site";
import { getEmailEnv } from "@/lib/utils/env";
import { formatTimestamp } from "@/lib/utils/dateTime";
import { siteUrl } from "@/lib/utils/siteUrl";

export type EmailLocale = "bn" | "en";

export interface EmailContext {
  locale: EmailLocale;
  appName: string;
  appUrl: string;
  appHost: string;
  tagline: string;
  summary: string;
  tips: readonly string[];
  logoUrl: string;
  supportEmail: string;
  senderEmail: string;
  senderName: string;
  timeZone: string;
  year: number;
  now: Date;
}

export type EmailContextOverrides = Partial<Omit<EmailContext, "appHost" | "year">>;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function emailContext(overrides: EmailContextOverrides = {}): EmailContext {
  const env = getEmailEnv();
  const locale = overrides.locale ?? (EMAIL_CONFIG.defaultLocale as EmailLocale);
  const appUrl = trimTrailingSlash(overrides.appUrl ?? siteUrl());
  const now = overrides.now ?? new Date();
  const senderEmail = overrides.senderEmail ?? env.EMAIL_FROM ?? EMAIL_CONFIG.sender.email;

  return {
    locale,
    appName: overrides.appName ?? SITE_NAME,
    appUrl,
    appHost: new URL(appUrl).host,
    tagline: overrides.tagline ?? EMAIL_CONFIG.brand.tagline[locale],
    summary: overrides.summary ?? EMAIL_CONFIG.brand.summary[locale],
    tips: overrides.tips ?? EMAIL_CONFIG.brand.tips[locale],
    logoUrl: overrides.logoUrl ?? env.EMAIL_LOGO_URL ?? `${appUrl}${EMAIL_CONFIG.logoPath}`,
    supportEmail: overrides.supportEmail ?? env.SUPPORT_EMAIL ?? senderEmail,
    senderEmail,
    senderName: overrides.senderName ?? env.EMAIL_FROM_NAME ?? EMAIL_CONFIG.sender.name,
    timeZone: overrides.timeZone ?? EMAIL_CONFIG.timeZone,
    year: now.getFullYear(),
    now,
  };
}

export function appLink(
  context: EmailContext,
  path: string,
  params: Record<string, string> = {},
): string {
  const url = new URL(path, `${context.appUrl}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export function formatDateTime(context: EmailContext, date: Date): string {
  return formatTimestamp(date, { timeZone: context.timeZone }) ?? "";
}

export function formatCount(context: EmailContext, value: number): string {
  return new Intl.NumberFormat(context.locale === "bn" ? "bn-BD" : "en-GB").format(value);
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
