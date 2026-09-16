import { SITE_URL_CONFIG } from "@/config/site";
import {
  DEFAULT_DOMAIN_SETTINGS,
  mergeDomainSettings,
  normalizeDomainUrl,
  normalizeVerificationCode,
  SITE_CONTENT_LIMITS,
  type DomainSettings,
} from "@/lib/site/contentShape";
import { siteContentCollection, withTimeout } from "@/lib/site/siteContent";
import { logger } from "@/lib/utils/logger";
import { setStoredSiteUrl, siteUrl } from "@/lib/utils/siteUrl";

export { effectiveSiteUrl, fallbackSiteUrl } from "@/lib/utils/siteUrl";

export {
  DEFAULT_DOMAIN_SETTINGS,
  normalizeDomainUrl,
  type DomainSettings,
} from "@/lib/site/contentShape";

export interface StoredDomainSettings {
  settings: DomainSettings;
  updatedAt: string | null;
  updatedBy: string | null;
}

const DOC_ID = "domain";

let snapshot: DomainSettings = { ...DEFAULT_DOMAIN_SETTINGS };
let loadedAt = 0;
let inFlight: Promise<DomainSettings> | null = null;
let generation = 0;

function apply(settings: DomainSettings): DomainSettings {
  setStoredSiteUrl(settings.url || null);
  return settings;
}

async function readDomain(): Promise<StoredDomainSettings> {
  const row = await (await siteContentCollection()).findOne({ _id: DOC_ID });
  return {
    settings: mergeDomainSettings(row?.value),
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export async function loadSiteDomain(): Promise<DomainSettings> {
  if (loadedAt > 0 && Date.now() - loadedAt < SITE_URL_CONFIG.cacheMs) return snapshot;
  if (inFlight) return inFlight;

  const started = generation;
  inFlight = withTimeout(readDomain(), SITE_CONTENT_LIMITS.loadTimeoutMs)
    .then(
      ({ settings }) => settings,
      (error: unknown) => {
        logger.warn("Site domain load failed, keeping the last known domain", {
          error: String(error).slice(0, 160),
        });
        return loadedAt > 0 ? snapshot : { ...DEFAULT_DOMAIN_SETTINGS };
      },
    )
    .then((settings) => {
      if (started !== generation) return snapshot;
      snapshot = settings;
      loadedAt = Date.now();
      return apply(settings);
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export async function resolveSiteUrl(): Promise<string> {
  await loadSiteDomain();
  return siteUrl();
}

export async function loadStoredSiteDomain(): Promise<StoredDomainSettings> {
  return readDomain();
}

export async function saveSiteDomain(
  input: { url: string; googleVerification: string },
  email: string,
): Promise<StoredDomainSettings> {
  const settings: DomainSettings = {
    url: input.url.trim() ? (normalizeDomainUrl(input.url) ?? "") : "",
    googleVerification: normalizeVerificationCode(input.googleVerification),
  };
  const updatedAt = new Date();

  await (
    await siteContentCollection()
  ).updateOne(
    { _id: DOC_ID },
    { $set: { value: settings, updatedAt, updatedBy: email } },
    { upsert: true },
  );

  generation += 1;
  snapshot = settings;
  loadedAt = Date.now();
  apply(settings);

  return { settings, updatedAt: updatedAt.toISOString(), updatedBy: email };
}
