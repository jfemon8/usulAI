import type { Metadata } from "next";
import { HelpDetailView } from "@/components/admin/help/HelpDetailView";

export const metadata: Metadata = { title: "প্রশ্নের বিস্তারিত" };

export default async function AdminHelpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HelpDetailView id={id} />;
}
