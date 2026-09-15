import { accountSummary, updateOwnProfile } from "@/lib/admin/accounts";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import { profileInput } from "@/lib/admin/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = adminRoute("panel.use", async (request, session) => {
  const input = await readJson(request, profileInput);
  await updateOwnProfile(session.email, input);
  const account = await accountSummary(session.email);
  const changed = [
    account?.name !== session.name ? "name" : null,
    input.phone !== undefined ? "phone" : null,
  ]
    .filter(Boolean)
    .join(", ");
  await recordAudit(session.email, "auth.profile-updated", undefined, changed || "no change");
  return adminJson({ account });
});
