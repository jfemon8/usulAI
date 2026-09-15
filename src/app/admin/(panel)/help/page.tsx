import type { Metadata } from "next";
import { HelpList } from "@/components/admin/help/HelpList";

export const metadata: Metadata = { title: "আলেমের কাছে প্রশ্ন" };

export default function AdminHelpPage() {
  return <HelpList />;
}
