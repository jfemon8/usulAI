import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/config/site";
import "./globals.css";

const DESCRIPTION = "কুরআন, হাদিস, ইজমা, কিয়াস ও সীরাতের আলোকে দলিলসহ উত্তর, এই তারতীব মেনে।";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: `${SITE_NAME}: ইসলামিক প্রশ্নোত্তর`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ইসলামিক প্রশ্নোত্তর`,
    description: DESCRIPTION,
    locale: "bn_BD",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: ইসলামিক প্রশ্নোত্তর`,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8edf5" },
    { media: "(prefers-color-scheme: dark)", color: "#080d15" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <body>
        <div className="ambient-light" aria-hidden="true">
          <span />
        </div>
        {children}
      </body>
    </html>
  );
}
