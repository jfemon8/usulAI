import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/dashboard/Dashboard";
import { requireAdminPage } from "@/lib/admin/guard";
import { principalView } from "@/lib/admin/sessions";

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const session = await requireAdminPage("dashboard.view");
  const { denied } = await searchParams;
  return <Dashboard principal={principalView(session)} denied={denied === "1"} />;
}
