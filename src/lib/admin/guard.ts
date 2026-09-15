import { redirect } from "next/navigation";
import { ADMIN_CONFIG } from "@/config/site";
import { can, type Permission } from "@/lib/admin/roles";
import { getAdminSession, type AdminSession } from "@/lib/admin/sessions";

export async function requireAdminPage(
  permission: Permission = "panel.use",
): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect(ADMIN_CONFIG.paths.login);
  if (!can(session.role, permission)) redirect(`${ADMIN_CONFIG.paths.dashboard}?denied=1`);
  return session;
}

export async function redirectIfSignedIn(): Promise<void> {
  if (await getAdminSession()) redirect(ADMIN_CONFIG.paths.dashboard);
}
