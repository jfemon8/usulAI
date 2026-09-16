import type { Metadata } from "next";
import { TopicManager } from "@/components/admin/topics/TopicManager";

export const metadata: Metadata = { title: "মাসআলার বিষয়" };

export default function AdminTopicsPage() {
  return <TopicManager />;
}
