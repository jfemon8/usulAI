import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, AdminError, readJson } from "@/lib/admin/http";
import { describeModelChain } from "@/lib/ai/providers";
import { loadStoredAiSettings, saveAiSettings } from "@/lib/site/aiSettings";
import { DEFAULT_AI_SETTINGS, SITE_CONTENT_LIMITS } from "@/lib/site/contentShape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LONG_DASH = String.fromCharCode(0x2014);

const aiSchema = z.object({
  extraInstructions: z
    .string()
    .max(SITE_CONTENT_LIMITS.extraInstructionsChars)
    .refine((value) => !value.includes(LONG_DASH), "লম্বা ড্যাশ ব্যবহার করা যাবে না"),
  disabledModels: z
    .array(z.string().min(1).max(SITE_CONTENT_LIMITS.modelIdChars))
    .max(SITE_CONTENT_LIMITS.maxDisabledModels),
  verifiedAnswersEnabled: z.boolean(),
});

function payload(stored: Awaited<ReturnType<typeof loadStoredAiSettings>>) {
  const models = describeModelChain();
  const disabled = new Set(stored.settings.disabledModels);
  const usable = models.filter((model) => model.keyConfigured);
  return {
    ...stored,
    defaults: DEFAULT_AI_SETTINGS,
    limits: { extraInstructionsChars: SITE_CONTENT_LIMITS.extraInstructionsChars },
    models,
    filterIgnored: usable.length > 0 && usable.every((model) => disabled.has(model.modelId)),
  };
}

export const GET = adminRoute("ai.manage", async () =>
  adminJson(payload(await loadStoredAiSettings())),
);

export const PUT = adminRoute("ai.manage", async (request, session) => {
  const body = await readJson(request, aiSchema);
  const known = new Set(describeModelChain().map((model) => model.modelId));
  const unknown = body.disabledModels.filter((model) => !known.has(model));
  if (unknown.length > 0) {
    throw new AdminError(`এই মডেলগুলো চেইনে নেই: ${unknown.join(", ")}`);
  }

  const saved = await saveAiSettings(body, session.email);
  await recordAudit(
    session.email,
    "ai.update",
    "ai",
    [
      `extra instructions ${saved.settings.extraInstructions.length} chars`,
      `disabled: ${saved.settings.disabledModels.join(", ") || "none"}`,
      `verified answers ${saved.settings.verifiedAnswersEnabled ? "on" : "off"}`,
    ].join("; "),
  );

  return adminJson(payload(saved));
});
