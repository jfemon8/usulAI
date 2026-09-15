import { z } from "zod";
import { ADMIN_CONFIG } from "@/config/site";
import { consumeResetToken, resetTokenEmail, setPassword } from "@/lib/admin/accounts";
import { recordAudit } from "@/lib/admin/audit";
import { adminFailure, adminJson, publicAdminRoute, readJson } from "@/lib/admin/http";
import { PASSWORD_MESSAGES, passwordProblem } from "@/lib/admin/password";
import { destroySessions } from "@/lib/admin/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRED = "রিসেট লিংকটি অবৈধ বা মেয়াদোত্তীর্ণ। আবার পাসওয়ার্ড রিসেটের অনুরোধ করুন।";

const checkSchema = z.object({ token: z.string().min(20).max(200) });

const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().max(ADMIN_CONFIG.maxPasswordChars),
  confirmation: z.string().max(ADMIN_CONFIG.maxPasswordChars),
});

export const PUT = publicAdminRoute("adminReset", async (request) => {
  const { token } = await readJson(request, checkSchema);
  const email = await resetTokenEmail(token);
  return email ? adminJson({ ok: true, email }) : adminFailure(EXPIRED, 410);
});

export const POST = publicAdminRoute("adminReset", async (request) => {
  const { token, password, confirmation } = await readJson(request, resetSchema);
  const problem = passwordProblem(password, confirmation);
  if (problem) return adminFailure(PASSWORD_MESSAGES[problem]);

  const email = await consumeResetToken(token);
  if (!email) return adminFailure(EXPIRED, 410);

  await setPassword(email, password);
  const signedOut = await destroySessions(email);
  await recordAudit(email, "auth.password-reset", undefined, `${signedOut} sessions signed out`);
  return adminJson({ ok: true, redirect: ADMIN_CONFIG.paths.login });
});
