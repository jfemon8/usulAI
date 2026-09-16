import type { Metadata } from "next";
import { DomainSettings } from "@/components/admin/domain/DomainSettings";

export const metadata: Metadata = { title: "ডোমেইন" };

export default function AdminDomainPage() {
  return <DomainSettings />;
}
