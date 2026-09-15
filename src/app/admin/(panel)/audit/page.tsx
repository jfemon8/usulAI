import type { Metadata } from "next";
import { AuditLog } from "@/components/admin/audit/AuditLog";

export const metadata: Metadata = { title: "অডিট লগ" };

export default function AdminAuditPage() {
  return <AuditLog />;
}
