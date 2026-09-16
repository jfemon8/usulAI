import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MasailShell } from "@/components/masail/MasailChrome";
import { RelatedMasail } from "@/components/masail/RelatedMasail";
import { BookIcon, QuestionIcon } from "@/components/ui/Icons";
import { HELP_CONFIG, MASAIL_CONFIG, SITE_NAME } from "@/config/site";
import { listPublishedMasail, type MasalaSummary } from "@/lib/analytics/verifiedAnswers";
import { categoryPath, getMasailCategory, type MasailCategory } from "@/lib/masail/categories";
import { resolveSiteUrl } from "@/lib/site/domain";

export const revalidate = 300;

type Params = { slug: string };

const loadTopic = cache((slug: string) => getMasailCategory(slug));

function describe(topic: MasailCategory, count: number): string {
  return (
    topic.description ||
    `${topic.name} নিয়ে আলেমদের যাচাই করা ${count > 0 ? `${count}টি ` : ""}মাসআলা, কুরআন, হাদিস ও ফিকহের দলিলসহ।`
  );
}

async function loadItems(slug: string): Promise<MasalaSummary[]> {
  try {
    const page = await listPublishedMasail({ category: slug, limit: MASAIL_CONFIG.topicPageSize });
    return page.items;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = await loadTopic(decodeURIComponent(slug)).catch(() => null);
  if (!topic) return { title: "বিষয়টি পাওয়া যায়নি", robots: { index: false } };

  const items = await loadItems(topic.slug);
  const title = `${topic.name} বিষয়ক মাসআলা`;
  const description = describe(topic, items.length);

  return {
    title,
    description,
    alternates: { canonical: categoryPath(topic.slug) },
    openGraph: { type: "website", title, description, url: categoryPath(topic.slug) },
    twitter: { card: "summary_large_image", title, description },
    ...(items.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

function structuredData(
  topic: MasailCategory,
  items: MasalaSummary[],
  baseUrl: string,
  description: string,
): string {
  const url = new URL(categoryPath(topic.slug), baseUrl).toString();
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url,
      name: `${topic.name} বিষয়ক মাসআলা`,
      description,
      inLanguage: "bn",
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: baseUrl },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.question,
          url: new URL(item.path, baseUrl).toString(),
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: baseUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: "মাসআলা",
          item: new URL(MASAIL_CONFIG.path, baseUrl).toString(),
        },
        { "@type": "ListItem", position: 3, name: topic.name, item: url },
      ],
    },
  ];

  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function TopicPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const topic = await loadTopic(decodeURIComponent(slug));
  if (!topic) notFound();

  const [items, baseUrl] = await Promise.all([loadItems(topic.slug), resolveSiteUrl()]);
  const description = describe(topic, items.length);

  return (
    <MasailShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: structuredData(topic, items, baseUrl, description),
        }}
      />

      <nav aria-label="অবস্থান" className="mb-4 text-sm">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-(--text-3)">
          <li>
            <Link href="/" className="transition hover:text-(--text-1)">
              হোম
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={MASAIL_CONFIG.path}
              className="inline-flex items-center gap-1.5 transition hover:text-(--text-1)"
            >
              <BookIcon className="h-4 w-4" />
              মাসআলা
            </Link>
          </li>
        </ol>
      </nav>

      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-(--text-1) sm:text-3xl">
          {topic.name} বিষয়ক মাসআলা
        </h1>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-(--text-2) sm:text-base sm:leading-7">
          {description}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-(--border) px-4 py-6 text-sm leading-6 text-(--text-2)">
          <p>এই বিষয়ে এখনো কোনো মাসআলা প্রকাশ করা হয়নি।</p>
          <p className="mt-3 flex flex-wrap gap-3">
            <Link href={MASAIL_CONFIG.path} className="font-medium text-(--accent) hover:underline">
              সব মাসআলা দেখুন
            </Link>
            <Link href={HELP_CONFIG.path} className="font-medium text-(--accent) hover:underline">
              আলেমের কাছে প্রশ্ন পাঠান
            </Link>
          </p>
        </div>
      ) : (
        <RelatedMasail items={items} heading={`${topic.name} নিয়ে ${items.length}টি মাসআলা`} bare />
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href={HELP_CONFIG.path}
          className="inline-flex items-center gap-2 font-medium text-(--accent) hover:underline"
        >
          <QuestionIcon className="h-4 w-4" />
          এই বিষয়ে নতুন প্রশ্ন পাঠান
        </Link>
      </div>
    </MasailShell>
  );
}
