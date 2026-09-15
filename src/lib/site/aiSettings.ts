import { mergeAiSettings, SITE_CONTENT_LIMITS, type AiSettings } from "@/lib/site/contentShape";
import { siteContentCollection, withTimeout } from "@/lib/site/siteContent";
import { logger } from "@/lib/utils/logger";

export { DEFAULT_AI_SETTINGS, mergeAiSettings, type AiSettings } from "@/lib/site/contentShape";

export interface StoredAiSettings {
  settings: AiSettings;
  updatedAt: string | null;
  updatedBy: string | null;
}

let snapshot: AiSettings = mergeAiSettings(null);
let loadedAt = 0;
let inFlight: Promise<AiSettings> | null = null;
let generation = 0;

export function aiSettingsSnapshot(): AiSettings {
  return snapshot;
}

async function readAi(): Promise<StoredAiSettings> {
  const row = await (await siteContentCollection()).findOne({ _id: "ai" });
  return {
    settings: mergeAiSettings(row?.value),
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export async function loadAiSettings(): Promise<AiSettings> {
  if (loadedAt > 0 && Date.now() - loadedAt < SITE_CONTENT_LIMITS.aiSettingsCacheMs) {
    return snapshot;
  }
  if (inFlight) return inFlight;

  const started = generation;
  inFlight = withTimeout(readAi(), SITE_CONTENT_LIMITS.loadTimeoutMs)
    .then(
      ({ settings }) => settings,
      (error: unknown) => {
        logger.warn("AI settings load failed, keeping the last known settings", {
          error: String(error).slice(0, 160),
        });
        return loadedAt > 0 ? snapshot : mergeAiSettings(null);
      },
    )
    .then((settings) => {
      if (started !== generation) return snapshot;
      snapshot = settings;
      loadedAt = Date.now();
      return settings;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export async function loadStoredAiSettings(): Promise<StoredAiSettings> {
  return readAi();
}

export function normalizeAiSettings(input: AiSettings): AiSettings {
  return mergeAiSettings({
    extraInstructions: input.extraInstructions.trim(),
    disabledModels: input.disabledModels,
    verifiedAnswersEnabled: input.verifiedAnswersEnabled,
  });
}

export async function saveAiSettings(input: AiSettings, email: string): Promise<StoredAiSettings> {
  const settings = normalizeAiSettings(input);
  const updatedAt = new Date();
  await (
    await siteContentCollection()
  ).updateOne(
    { _id: "ai" },
    { $set: { value: settings, updatedAt, updatedBy: email } },
    { upsert: true },
  );
  generation += 1;
  snapshot = settings;
  loadedAt = Date.now();
  return { settings, updatedAt: updatedAt.toISOString(), updatedBy: email };
}
