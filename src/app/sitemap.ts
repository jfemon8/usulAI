import type { MetadataRoute } from "next";
import { MASAIL_CONFIG } from "@/config/site";
import { listPublishedMasail } from "@/lib/analytics/verifiedAnswers";
import { listMasailCategories, publishedCategoryCounts } from "@/lib/masail/categories";
import { resolveSiteUrl } from "@/lib/site/domain";
import { logger } from "@/lib/utils/logger";

export const revalidate = 300;

async function publishedEntries(base: string): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  let cursor: string | null = null;

  for (let page = 0; page < MASAIL_CONFIG.sitemapPages; page += 1) {
    const result = await listPublishedMasail({
      cursor,
      limit: MASAIL_CONFIG.sitemapPageSize,
    });

    for (const masala of result.items) {
      const changed = masala.updatedAt ?? masala.publishedAt;
      entries.push({
        url: new URL(masala.path, base).toString(),
        ...(changed ? { lastModified: new Date(changed) } : {}),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }

    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await resolveSiteUrl();
  const now = new Date();

  const fixed: MetadataRoute.Sitemap = [
    { url: new URL("/", base).toString(), lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: new URL(MASAIL_CONFIG.path, base).toString(),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const [items, counts] = await Promise.all([listMasailCategories(), publishedCategoryCounts()]);
    const topics: MetadataRoute.Sitemap = items
      .filter((topic) => (counts[topic.slug] ?? 0) > 0)
      .map((topic) => ({
        url: new URL(topic.path, base).toString(),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      }));

    return [...fixed, ...topics, ...(await publishedEntries(base))];
  } catch (error) {
    logger.warn("Sitemap could not list published masail", {
      error: String(error).slice(0, 160),
    });
    return fixed;
  }
}
