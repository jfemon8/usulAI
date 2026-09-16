import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/ChatApp";
import { loadHomeContent } from "@/lib/site/siteContent";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function HomePage() {
  const homeContent = await loadHomeContent();
  return <ChatApp homeContent={homeContent} />;
}
