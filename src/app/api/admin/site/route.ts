import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, AdminError, readJson } from "@/lib/admin/http";
import { DEFAULT_HOME_CONTENT, safeLinkUrl, SITE_CONTENT_LIMITS } from "@/lib/site/contentShape";
import { loadStoredHomeContent, saveHomeContent } from "@/lib/site/siteContent";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LONG_DASH = String.fromCharCode(0x2014);

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !value.includes(LONG_DASH), "লম্বা ড্যাশ ব্যবহার করা যাবে না");

const homeSchema = z.object({
  bismillah: plain(SITE_CONTENT_LIMITS.bismillahChars),
  greeting: plain(SITE_CONTENT_LIMITS.greetingChars).refine(
    (value) => value.trim().length > 0,
    "শুভেচ্ছা খালি রাখা যাবে না",
  ),
  subtitle: plain(SITE_CONTENT_LIMITS.subtitleChars),
  suggestions: z
    .array(
      plain(SITE_CONTENT_LIMITS.suggestionChars).refine(
        (value) => value.trim().length > 0,
        "প্রশ্ন খালি রাখা যাবে না",
      ),
    )
    .max(SITE_CONTENT_LIMITS.maxSuggestions),
  announcement: z.object({
    enabled: z.boolean(),
    text: plain(SITE_CONTENT_LIMITS.announcementChars),
    tone: z.enum(["info", "warning"]),
    link: z
      .object({
        label: plain(SITE_CONTENT_LIMITS.linkLabelChars),
        url: z.string().max(SITE_CONTENT_LIMITS.linkUrlChars),
      })
      .optional(),
  }),
});

export const GET = adminRoute("site.manage", async () => {
  const stored = await loadStoredHomeContent();
  return adminJson({ ...stored, defaults: DEFAULT_HOME_CONTENT, limits: SITE_CONTENT_LIMITS });
});

export const PUT = adminRoute("site.manage", async (request, session) => {
  const body = await readJson(request, homeSchema);

  if (body.announcement.enabled && body.announcement.text.trim().length === 0) {
    throw new AdminError("ঘোষণা চালু করতে হলে ঘোষণার লেখা দিতে হবে।");
  }
  const link = body.announcement.link;
  const hasLink = Boolean(link && (link.label.trim() || link.url.trim()));
  if (hasLink && (!link?.label.trim() || !safeLinkUrl(link.url))) {
    throw new AdminError(
      "লিংকের লেখা দিন এবং ঠিকানা http:// বা https:// দিয়ে শুরু করুন (অথবা সাইটের ভেতরের পথ / দিয়ে)।",
    );
  }

  const saved = await saveHomeContent(
    {
      ...body,
      announcement: {
        enabled: body.announcement.enabled,
        text: body.announcement.text,
        tone: body.announcement.tone,
        ...(hasLink && link ? { link } : {}),
      },
    },
    session.email,
  );

  try {
    revalidatePath("/");
    revalidatePath("/embed");
  } catch (error) {
    logger.warn("Home page revalidation failed", { error: String(error).slice(0, 160) });
  }

  await recordAudit(
    session.email,
    "site.update",
    "home",
    `${saved.content.suggestions.length} suggestions, announcement ${
      saved.content.announcement.enabled ? "on" : "off"
    }`,
  );

  return adminJson({ ...saved, defaults: DEFAULT_HOME_CONTENT, limits: SITE_CONTENT_LIMITS });
});
