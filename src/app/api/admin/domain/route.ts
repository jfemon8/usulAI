import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MASAIL_CONFIG } from "@/config/site";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, AdminError, readJson } from "@/lib/admin/http";
import { SITE_CONTENT_LIMITS } from "@/lib/site/contentShape";
import { normalizeVerificationCode } from "@/lib/site/contentShape";
import {
  effectiveSiteUrl,
  fallbackSiteUrl,
  loadStoredSiteDomain,
  normalizeDomainUrl,
  saveSiteDomain,
} from "@/lib/site/domain";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().max(SITE_CONTENT_LIMITS.domainChars),
  googleVerification: z.string().max(SITE_CONTENT_LIMITS.domainChars).default(""),
});

const INVALID =
  "ডোমেইনটি সঠিক নয়। শুধু ঠিকানা লিখুন, যেমন usulai.com বা https://usulai.com। পথ, প্রশ্নচিহ্ন বা লগইন তথ্য দেওয়া যাবে না, আর https ছাড়া চলবে না।";

function payload(stored: Awaited<ReturnType<typeof loadStoredSiteDomain>>) {
  return {
    ...stored,
    fallbackUrl: fallbackSiteUrl(),
    effectiveUrl: effectiveSiteUrl(stored.settings.url),
    limits: { domainChars: SITE_CONTENT_LIMITS.domainChars },
  };
}

export const GET = adminRoute("domain.manage", async () => {
  return adminJson(payload(await loadStoredSiteDomain()));
});

export const PUT = adminRoute("domain.manage", async (request, session) => {
  const { url, googleVerification } = await readJson(request, schema);
  const trimmed = url.trim();
  if (trimmed && !normalizeDomainUrl(trimmed)) throw new AdminError(INVALID);
  if (googleVerification.trim() && !normalizeVerificationCode(googleVerification)) {
    throw new AdminError(
      "Google যাচাই কোডটি সঠিক নয়। Search Console থেকে পাওয়া meta ট্যাগের content অংশটুকু দিন।",
    );
  }

  const saved = await saveSiteDomain({ url: trimmed, googleVerification }, session.email);

  try {
    revalidatePath("/", "layout");
    revalidatePath(MASAIL_CONFIG.path);
    revalidatePath("/sitemap.xml");
    revalidatePath("/robots.txt");
  } catch (error) {
    logger.warn("Domain revalidation failed", { error: String(error).slice(0, 160) });
  }

  await recordAudit(
    session.email,
    "site.domain",
    "domain",
    saved.settings.url || `fallback ${fallbackSiteUrl()}`,
  );

  return adminJson(payload(saved));
});
