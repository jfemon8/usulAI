import type { Metadata } from "next";
import { ReviewDetail } from "@/components/admin/reviews/ReviewDetail";
import { requireAdminPage } from "@/lib/admin/guard";
import { principalView } from "@/lib/admin/sessions";

export const metadata: Metadata = { title: "উত্তর রিভিউ" };

export default async function AdminReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminPage("reviews.view");
  const { id } = await params;
  return <ReviewDetail key={id} id={id} principal={principalView(session)} />;
}
