import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin/guard";
import { principalView } from "@/lib/admin/sessions";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();
  return <AdminShell principal={principalView(session)}>{children}</AdminShell>;
}
