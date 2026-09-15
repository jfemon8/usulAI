import type { Metadata } from "next";
import { AnswerEditor } from "@/components/admin/answers/AnswerEditor";

export const metadata: Metadata = { title: "উত্তর সম্পাদনা" };

export default async function EditAnswerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnswerEditor key={id} id={id} />;
}
