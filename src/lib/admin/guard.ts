import { redirect } from "next/navigation";
import { ADMIN_CONFIG } from "@/config/site";
import { getAdminSession, type AdminSession } from "@/lib/admin/sessions";

export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect(ADMIN_CONFIG.paths.login);
  return session;
}

export async function redirectIfSignedIn(): Promise<void> {
  if (await getAdminSession()) redirect(ADMIN_CONFIG.paths.dashboard);
}
