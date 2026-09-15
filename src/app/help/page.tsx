import type { Metadata } from "next";
import { MyHelpRequests } from "@/components/help/MyHelpRequests";

export const metadata: Metadata = { title: "আমার প্রশ্নগুলো" };

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ ask?: string | string[] }>;
}) {
  const { ask } = await searchParams;
  return <MyHelpRequests initialAsk={ask === "1"} />;
}
