import { MASAIL_CONFIG, SITE_NAME } from "@/config/site";

const DESCRIPTION =
  "কুরআন, হাদিস, ইজমা, কিয়াস, সীরাত ও ফিকহের দলিলসহ বাংলা ইসলামিক প্রশ্নোত্তর। আলেমদের যাচাই করা মাসআলা ও ফতোয়া।";

export function SiteStructuredData({ baseUrl }: { baseUrl: string }) {
  const organization = {
    "@type": "Organization",
    "@id": `${baseUrl}#organization`,
    name: SITE_NAME,
    url: baseUrl,
    logo: { "@type": "ImageObject", url: new URL("/pwa/icon-512.png", baseUrl).toString() },
    description: DESCRIPTION,
  };

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        "@id": `${baseUrl}#website`,
        url: baseUrl,
        name: SITE_NAME,
        description: DESCRIPTION,
        inLanguage: "bn",
        publisher: { "@id": `${baseUrl}#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${new URL(MASAIL_CONFIG.path, baseUrl).toString()}?search={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
