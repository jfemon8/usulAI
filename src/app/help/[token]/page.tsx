import type { Metadata } from "next";
import { HelpTracker } from "@/components/help/HelpTracker";

export const metadata: Metadata = { title: "প্রশ্নের অবস্থা" };

export const dynamic = "force-dynamic";

export default async function HelpTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <HelpTracker token={token} />;
}
