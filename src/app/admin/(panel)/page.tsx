import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/dashboard/Dashboard";
import { requireAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  return <Dashboard email={session.email} />;
}
