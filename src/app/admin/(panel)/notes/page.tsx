import type { Metadata } from "next";
import { NotesEditor } from "@/components/admin/notes/NotesEditor";

export const metadata: Metadata = { title: "কুরআনের নোট" };

export default function AdminNotesPage() {
  return <NotesEditor />;
}
