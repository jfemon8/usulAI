import type { Metadata } from "next";
import { FileManager } from "@/components/admin/files/FileManager";

export const metadata: Metadata = { title: "ফাইল" };

export default function AdminFilesPage() {
  return <FileManager />;
}
