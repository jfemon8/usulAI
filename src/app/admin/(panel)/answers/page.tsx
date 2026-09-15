import type { Metadata } from "next";
import { AnswerList } from "@/components/admin/answers/AnswerList";

export const metadata: Metadata = { title: "যাচাইকৃত উত্তর" };

export default function AdminAnswersPage() {
  return <AnswerList />;
}
