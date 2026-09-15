import type { Metadata } from "next";
import { MasalaEditor } from "@/components/admin/masail/MasalaEditor";
import { requireAdminPage } from "@/lib/admin/guard";
import { principalView } from "@/lib/admin/sessions";

export const metadata: Metadata = { title: "মাসআলা" };

export default async function EditMasalaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminPage("masail.write");
  const { id } = await params;
  return <MasalaEditor key={id} id={id} principal={principalView(session)} />;
}
