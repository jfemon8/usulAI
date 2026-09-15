import type { Metadata } from "next";
import { SiteContentEditor } from "@/components/admin/site/SiteContentEditor";

export const metadata: Metadata = { title: "সাইট কনটেন্ট" };

export default function AdminSitePage() {
  return <SiteContentEditor />;
}
