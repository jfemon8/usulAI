import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteStructuredData } from "@/components/site/SiteStructuredData";
import { SITE_NAME } from "@/config/site";
import { loadSiteDomain, resolveSiteUrl } from "@/lib/site/domain";
import "./globals.css";

const DESCRIPTION =
  "কুরআন, হাদিস, ইজমা, কিয়াস, সীরাত ও ফিকহের দলিলসহ বাংলা ইসলামিক প্রশ্নোত্তর। আলেমদের যাচাই করা মাসআলা ও ফতোয়া, সূত্রসহ।";

const KEYWORDS = [
  "ইসলামিক প্রশ্নোত্তর",
  "মাসআলা",
  "ফতোয়া",
  "বাংলা ইসলামিক প্রশ্ন উত্তর",
  "কুরআন ও হাদিসের আলোকে উত্তর",
  "নামাজের মাসআলা",
  "রোজার মাসআলা",
  "যাকাতের মাসআলা",
  "ইসলামিক জিজ্ঞাসা",
  "মুফতির কাছে প্রশ্ন",
];

const HOME_TITLE = `বাংলা ইসলামিক প্রশ্নোত্তর ও মাসআলা | ${SITE_NAME}`;

export async function generateMetadata(): Promise<Metadata> {
  const [baseUrl, domain] = await Promise.all([resolveSiteUrl(), loadSiteDomain()]);

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: HOME_TITLE,
      template: `%s · ${SITE_NAME}`,
    },
    description: DESCRIPTION,
    keywords: KEYWORDS,
    applicationName: SITE_NAME,
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "religion",
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
    },
    ...(domain.googleVerification ? { verification: { google: domain.googleVerification } } : {}),
    appleWebApp: {
      capable: true,
      title: SITE_NAME,
      statusBarStyle: "default",
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: HOME_TITLE,
      description: DESCRIPTION,
      locale: "bn_BD",
    },
    twitter: {
      card: "summary_large_image",
      title: HOME_TITLE,
      description: DESCRIPTION,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1d21" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const baseUrl = await resolveSiteUrl();

  return (
    <html lang="bn">
      <body>
        <SiteStructuredData baseUrl={baseUrl} />
        {children}
      </body>
    </html>
  );
}
