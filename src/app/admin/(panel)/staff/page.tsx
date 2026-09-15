import type { Metadata } from "next";
import { StaffManager } from "@/components/admin/staff/StaffManager";

export const metadata: Metadata = { title: "স্টাফ ও ক্যাটাগরি" };

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  return <StaffManager initialTab={tab === "categories" ? "categories" : "accounts"} />;
}
