import type { Metadata } from "next";
import { CorpusEditor } from "@/components/admin/corpus/CorpusEditor";

export const metadata: Metadata = { title: "দলিল সম্পাদনা" };

export default async function CorpusDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CorpusEditor key={id} id={id} />;
}
