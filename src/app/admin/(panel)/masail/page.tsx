import type { Metadata } from "next";
import { MasailWorkspace } from "@/components/admin/masail/MasailWorkspace";
import { requireAdminPage } from "@/lib/admin/guard";
import { principalView } from "@/lib/admin/sessions";

export const metadata: Metadata = { title: "মাসআলা ও ফতোয়া" };

export default async function AdminMasailPage() {
  const session = await requireAdminPage("masail.write");
  return <MasailWorkspace principal={principalView(session)} />;
}
