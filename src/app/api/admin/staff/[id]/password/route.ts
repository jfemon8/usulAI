import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { resetStaffPassword, sendStaffAccountEmail, staffPasswordInput } from "@/lib/admin/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const POST = adminRoute<Params>("staff.manage", async (request, session, params) => {
  const { password } = await readJson(request, staffPasswordInput);
  const account = await resetStaffPassword(params.id, password, session.email);
  const email = await sendStaffAccountEmail("reset", account, password);
  await recordAudit(
    session.email,
    "staff.password-reset",
    `staff:${account.email}`,
    `signed out; email ${email.sent ? "sent" : "not sent"}`,
  );
  return adminJson({ account, email });
});
