import type { Metadata } from "next";
import { MasalaEditor } from "@/components/admin/masail/MasalaEditor";
import { requireAdminPage } from "@/lib/admin/guard";
import { principalView } from "@/lib/admin/sessions";

export const metadata: Metadata = { title: "নতুন মাসআলা" };

export default async function NewMasalaPage() {
  const session = await requireAdminPage("masail.write");
  return <MasalaEditor principal={principalView(session)} />;
}
