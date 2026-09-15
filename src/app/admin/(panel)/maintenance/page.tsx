import type { Metadata } from "next";
import { MaintenancePanel } from "@/components/admin/maintenance/MaintenancePanel";

export const metadata: Metadata = { title: "রক্ষণাবেক্ষণ" };

export default function AdminMaintenancePage() {
  return <MaintenancePanel />;
}
