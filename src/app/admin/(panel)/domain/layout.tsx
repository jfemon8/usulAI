import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/admin/guard";

export default async function Layout({ children }: { children: ReactNode }) {
  await requireAdminPage("domain.manage");
  return children;
}
