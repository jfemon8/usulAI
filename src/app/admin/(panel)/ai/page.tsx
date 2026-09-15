import type { Metadata } from "next";
import { AiSettingsEditor } from "@/components/admin/ai/AiSettingsEditor";

export const metadata: Metadata = { title: "AI সেটিংস" };

export default function AdminAiPage() {
  return <AiSettingsEditor />;
}
