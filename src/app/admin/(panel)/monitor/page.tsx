import type { Metadata } from "next";
import { QueryMonitor } from "@/components/admin/monitor/QueryMonitor";

export const metadata: Metadata = { title: "প্রশ্ন ও উত্তরের লগ" };

export default function AdminMonitorPage() {
  return <QueryMonitor />;
}
