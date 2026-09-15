import type { Metadata } from "next";
import { ReviewQueue } from "@/components/admin/reviews/ReviewQueue";
import { requireAdminPage } from "@/lib/admin/guard";
import { principalView } from "@/lib/admin/sessions";

export const metadata: Metadata = { title: "উত্তর রিভিউ" };

export default async function AdminReviewsPage() {
  const session = await requireAdminPage("reviews.view");
  return <ReviewQueue principal={principalView(session)} />;
}
