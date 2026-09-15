import { DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import {
  cleanSuggestions,
  DEFAULT_HOME_CONTENT,
  mergeHomeContent,
  safeLinkUrl,
  SITE_CONTENT_LIMITS,
  type HomeContent,
} from "@/lib/site/contentShape";
import { logger } from "@/lib/utils/logger";

export {
  DEFAULT_HOME_CONTENT,
  DEFAULT_QUESTION_POOL,
  mergeHomeContent,
  type Announcement,
  type AnnouncementTone,
  type HomeContent,
} from "@/lib/site/contentShape";

export interface SiteContentDocument {
  _id: string;
  value: unknown;
  updatedAt: Date;
  updatedBy: string;
}

export interface StoredHomeContent {
  content: HomeContent;
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function siteContentCollection() {
  return (await getDb()).collection<SiteContentDocument>(DB_CONFIG.siteContentCollection);
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function readHome(): Promise<StoredHomeContent> {
  const row = await (await siteContentCollection()).findOne({ _id: "home" });
  return {
    content: mergeHomeContent(row?.value),
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export async function loadHomeContent(): Promise<HomeContent> {
  try {
    return (await withTimeout(readHome(), SITE_CONTENT_LIMITS.loadTimeoutMs)).content;
  } catch (error) {
    logger.warn("Home content load failed, using defaults", {
      error: String(error).slice(0, 160),
    });
    return mergeHomeContent(null);
  }
}

export async function loadStoredHomeContent(): Promise<StoredHomeContent> {
  return readHome();
}

export function normalizeHomeContent(input: HomeContent): HomeContent {
  const link = input.announcement.link;
  const url = link ? safeLinkUrl(link.url) : null;
  const label = link?.label.trim() ?? "";
  const announcementText = input.announcement.text.trim();

  return {
    bismillah: input.bismillah.trim(),
    greeting: input.greeting.trim() || DEFAULT_HOME_CONTENT.greeting,
    subtitle: input.subtitle.trim(),
    suggestions: cleanSuggestions(input.suggestions),
    announcement: {
      enabled: input.announcement.enabled && announcementText.length > 0,
      text: announcementText,
      tone: input.announcement.tone,
      ...(url && label ? { link: { label, url } } : {}),
    },
  };
}

export async function saveHomeContent(
  input: HomeContent,
  email: string,
): Promise<StoredHomeContent> {
  const content = normalizeHomeContent(input);
  const updatedAt = new Date();
  await (
    await siteContentCollection()
  ).updateOne(
    { _id: "home" },
    { $set: { value: content, updatedAt, updatedBy: email } },
    { upsert: true },
  );
  return { content, updatedAt: updatedAt.toISOString(), updatedBy: email };
}
