import type { Metadata } from "next";
import { MyHelpRequests } from "@/components/help/MyHelpRequests";

export const metadata: Metadata = { title: "আমার প্রশ্নগুলো" };

export default function HelpPage() {
  return <MyHelpRequests />;
}
