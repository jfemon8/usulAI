import { z } from "zod";
import { ADMIN_CONFIG } from "@/config/site";
import { checkPassword, setPassword } from "@/lib/admin/accounts";
import { recordAudit } from "@/lib/admin/audit";
import { adminFailure, adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { PASSWORD_MESSAGES, passwordProblem } from "@/lib/admin/password";
import { destroySessions } from "@/lib/admin/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  current: z.string().min(1).max(ADMIN_CONFIG.maxPasswordChars),
  password: z.string().max(ADMIN_CONFIG.maxPasswordChars),
  confirmation: z.string().max(ADMIN_CONFIG.maxPasswordChars),
  signOutOthers: z.boolean().default(true),
});

export const POST = adminRoute(async (request, session) => {
  const { current, password, confirmation, signOutOthers } = await readJson(request, schema);

  if (!(await checkPassword(session.email, current))) {
    return adminFailure("বর্তমান পাসওয়ার্ড সঠিক নয়।", 403);
  }
  const problem = passwordProblem(password, confirmation, current);
  if (problem) return adminFailure(PASSWORD_MESSAGES[problem]);

  await setPassword(session.email, password);
  const signedOut = signOutOthers ? await destroySessions(session.email, session.id) : 0;
  await recordAudit(
    session.email,
    "auth.password-changed",
    undefined,
    `${signedOut} other sessions signed out`,
  );
  return adminJson({ ok: true, signedOut });
});
