import type { Metadata } from "next";
import { DatabaseOverview } from "@/components/admin/database/DatabaseOverview";

export const metadata: Metadata = { title: "ডাটাবেস" };

export default function AdminDatabasePage() {
  return <DatabaseOverview />;
}
