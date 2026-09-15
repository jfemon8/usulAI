import { z } from "zod";
import { ADMIN_CONFIG, EMAIL_CONFIG } from "@/config/site";
import { createResetToken, normalizeEmail } from "@/lib/admin/accounts";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, publicAdminRoute, readJson } from "@/lib/admin/http";
import { isEmailConfigured, sendRenderedEmail } from "@/lib/email/mailer";
import { passwordResetEmail } from "@/lib/email/templates";
import { clientAddress } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";
import { siteUrl } from "@/lib/utils/siteUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().max(254) });

const SENT_MESSAGE =
  "ইমেইলটি প্যানেলের কোনো অ্যাকাউন্টের হলে পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।";

function deviceFrom(userAgent: string): string | undefined {
  if (!userAgent) return undefined;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "ব্রাউজার";
  const system = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : undefined;
  return system ? `${browser}, ${system}` : browser;
}

export const POST = publicAdminRoute("adminReset", async (request) => {
  const { email } = await readJson(request, schema);
  const address = normalizeEmail(email);
  const token = await createResetToken(address);
  if (!token) {
    logger.warn("Admin password reset throttled", { email: address });
    return adminJson({ ok: true, message: SENT_MESSAGE });
  }

  if (!isEmailConfigured()) {
    logger.error("Admin password reset requested but MAILTRAP_API_TOKEN is not set");
  }

  const resetUrl = new URL(ADMIN_CONFIG.paths.resetPassword, `${siteUrl().replace(/\/+$/, "")}/`);
  resetUrl.searchParams.set("token", token);
  const device = deviceFrom(request.headers.get("user-agent") ?? "");
  const ipAddress = clientAddress(request);

  const result = await sendRenderedEmail(
    address,
    passwordResetEmail({
      email: address,
      resetUrl: resetUrl.toString(),
      expiresInMinutes: ADMIN_CONFIG.resetMinutes,
      requestedAt: new Date(),
      ...(device ? { device } : {}),
      ...(ipAddress !== "unknown" ? { ipAddress } : {}),
    }),
    EMAIL_CONFIG.categories.passwordReset,
  );

  if (!result.sent) {
    logger.error("Admin password reset email failed", { error: result.error?.slice(0, 200) });
  }
  await recordAudit(address, "auth.reset-requested", undefined, result.sent ? "sent" : "not sent");
  return adminJson({ ok: true, message: SENT_MESSAGE });
});
