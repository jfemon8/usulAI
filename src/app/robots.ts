import type { MetadataRoute } from "next";
import { ADMIN_CONFIG, HELP_CONFIG } from "@/config/site";
import { resolveSiteUrl } from "@/lib/site/domain";

export const revalidate = 300;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await resolveSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/embed", ADMIN_CONFIG.paths.dashboard, HELP_CONFIG.path],
      },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
