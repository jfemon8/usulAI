import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/ChatApp";
import { loadHomeContent } from "@/lib/site/siteContent";

export const revalidate = 300;

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function EmbedPage() {
  const homeContent = await loadHomeContent();
  return <ChatApp compact homeContent={homeContent} />;
}
