import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicShell } from "@/components/site/PublicShell";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: { default: "আলেমের কাছে প্রশ্ন", template: `%s · ${SITE_NAME}` },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
