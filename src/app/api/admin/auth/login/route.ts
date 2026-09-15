import { z } from "zod";
import { ADMIN_CONFIG } from "@/config/site";
import { authenticate } from "@/lib/admin/accounts";
import { recordAudit } from "@/lib/admin/audit";
import { adminFailure, adminJson, publicAdminRoute, readJson } from "@/lib/admin/http";
import { createSession } from "@/lib/admin/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(ADMIN_CONFIG.maxPasswordChars),
});

export const POST = publicAdminRoute("adminLogin", async (request) => {
  const { email, password } = await readJson(request, schema);
  const result = await authenticate(email, password);

  if (!result.ok) {
    if (result.reason === "locked") {
      return adminFailure(
        `অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। নিরাপত্তার জন্য ${result.minutes} মিনিট পর আবার চেষ্টা করুন।`,
        423,
      );
    }
    return adminFailure("ইমেইল বা পাসওয়ার্ড সঠিক নয়।", 401);
  }

  await createSession(result.email, request);
  await recordAudit(result.email, "auth.login");
  return adminJson({ ok: true, redirect: ADMIN_CONFIG.paths.dashboard });
});
