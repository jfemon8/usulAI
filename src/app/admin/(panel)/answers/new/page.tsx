import type { Metadata } from "next";
import { AnswerEditor } from "@/components/admin/answers/AnswerEditor";

export const metadata: Metadata = { title: "নতুন যাচাইকৃত উত্তর" };

export default function NewAnswerPage() {
  return <AnswerEditor />;
}
