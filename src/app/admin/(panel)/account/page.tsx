import type { Metadata } from "next";
import { AccountSettings } from "@/components/admin/account/AccountSettings";

export const metadata: Metadata = { title: "অ্যাকাউন্ট" };

export default function AdminAccountPage() {
  return <AccountSettings />;
}
