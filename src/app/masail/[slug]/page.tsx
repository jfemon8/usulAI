import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { RichContent } from "@/components/editor/RichContent";
import { SourceCitationList } from "@/components/chat/SourceCitation";
import { authorLabel, MasailShell, publishedLabel } from "@/components/masail/MasailChrome";
import { RelatedMasail } from "@/components/masail/RelatedMasail";
import { AlertIcon, BookIcon, PenIcon, QuestionIcon } from "@/components/ui/Icons";
import { HELP_CONFIG, MASAIL_CONFIG, SITE_NAME } from "@/config/site";
import {
  decodeSegment,
  getPublishedMasala,
  listRelatedMasail,
  masalaIdFromSlug,
  masalaPath,
  masalaSegment,
  type MasalaDetail,
} from "@/lib/analytics/verifiedAnswers";
import { resolveSiteUrl } from "@/lib/site/domain";

export const revalidate = 300;

type Params = { slug: string };

const loadMasala = cache((id: string) => getPublishedMasala(id));

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const id = masalaIdFromSlug(slug);
  const masala = id ? await loadMasala(id).catch(() => null) : null;
  if (!masala) return { title: "মাসআলা পাওয়া যায়নি", robots: { index: false } };

  const path = masalaPath(masala.id, masala.question);
  const author = authorLabel(masala.author);

  return {
    title: masala.question,
    description: masala.excerpt,
    alternates: { canonical: path },
    ...(author ? { authors: [{ name: author }] } : {}),
    openGraph: {
      type: "article",
      title: masala.question,
      description: masala.excerpt,
      url: path,
      ...(masala.publishedAt ? { publishedTime: masala.publishedAt } : {}),
      ...(masala.updatedAt ? { modifiedTime: masala.updatedAt } : {}),
      ...(author ? { authors: [author] } : {}),
    },
    twitter: { card: "summary_large_image", title: masala.question, description: masala.excerpt },
  };
}

function structuredData(masala: MasalaDetail, baseUrl: string): string {
  const url = new URL(masalaPath(masala.id, masala.question), baseUrl).toString();
  const site = { "@type": "Organization", name: SITE_NAME, url: baseUrl };
  const author = masala.author
    ? { "@type": "Person", name: authorLabel(masala.author) ?? masala.author.name }
    : site;

  const data = [
    {
      "@context": "https://schema.org",
      "@type": "QAPage",
      url,
      inLanguage: "bn",
      publisher: site,
      mainEntity: {
        "@type": "Question",
        name: masala.question,
        text: masala.question,
        answerCount: 1,
        ...(masala.publishedAt ? { datePublished: masala.publishedAt } : {}),
        ...(masala.updatedAt ? { dateModified: masala.updatedAt } : {}),
        author: site,
        acceptedAnswer: {
          "@type": "Answer",
          text: masala.answer,
          url,
          ...(masala.publishedAt ? { datePublished: masala.publishedAt } : {}),
          ...(masala.updatedAt ? { dateModified: masala.updatedAt } : {}),
          author,
        },
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
        { "@type": "ListItem", position: 3, name: masala.question, item: url },
      ],
    },
  ];

  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const ACTION_LINK =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition";

export default async function MasalaPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const id = masalaIdFromSlug(slug);
  const masala = id ? await loadMasala(id) : null;
  if (!masala) notFound();

  if (decodeSegment(slug) !== masalaSegment(masala.id, masala.question)) {
    permanentRedirect(masalaPath(masala.id, masala.question));
  }

  const [baseUrl, related] = await Promise.all([
    resolveSiteUrl(),
    listRelatedMasail(masala).catch(() => []),
  ]);

  const author = authorLabel(masala.author);
  const published = publishedLabel(masala.publishedAt);
  const updated =
    masala.updatedAt && masala.updatedAt !== masala.publishedAt
      ? publishedLabel(masala.updatedAt)
      : null;

  return (
    <MasailShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData(masala, baseUrl) }}
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

      <article>
        <header className="border-b border-(--border) pb-5">
          <h1 className="text-xl leading-9 font-semibold tracking-tight text-balance break-words text-(--text-1) sm:text-2xl sm:leading-10">
            {masala.question}
          </h1>
          <div className="mt-3 flex flex-col gap-1 text-sm text-(--text-2)">
            {author ? (
              <p>
                উত্তর দিয়েছেন: <span className="font-medium text-(--accent)">{author}</span>
              </p>
            ) : null}
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--text-3)">
              {published && masala.publishedAt ? (
                <span>
                  প্রকাশিত: <time dateTime={masala.publishedAt}>{published}</time>
                </span>
              ) : null}
              {updated && masala.updatedAt ? (
                <span>
                  হালনাগাদ: <time dateTime={masala.updatedAt}>{updated}</time>
                </span>
              ) : null}
            </p>
          </div>
        </header>

        <div className="pt-5">
          <RichContent text={masala.answer} />
          <SourceCitationList sources={masala.sources} />
        </div>
      </article>

      <aside className="mt-8 flex items-start gap-2.5 rounded-2xl bg-(--warn-soft) px-4 py-3.5 text-sm leading-6 text-(--warn)">
        <AlertIcon className="mt-1 h-4 w-4 shrink-0" />
        <p>
          এটি একটি সাধারণ মাসআলা। আপনার ব্যক্তিগত অবস্থার সঙ্গে পার্থক্য থাকলে সরাসরি একজন
          নির্ভরযোগ্য আলেম বা মুফতির সঙ্গে পরামর্শ করুন।
        </p>
      </aside>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href={HELP_CONFIG.path}
          className={`${ACTION_LINK} bg-(--accent) text-(--accent-contrast) hover:bg-(--accent-strong)`}
        >
          <QuestionIcon className="h-4 w-4" />
          আলেমের কাছে প্রশ্ন পাঠান
        </Link>
        <Link
          href="/"
          className={`${ACTION_LINK} border border-(--border) text-(--text-1) hover:bg-(--surface-2)`}
        >
          <PenIcon className="h-4 w-4" />
          চ্যাটে প্রশ্ন করুন
        </Link>
        <Link
          href={MASAIL_CONFIG.path}
          className={`${ACTION_LINK} border border-(--border) text-(--text-1) hover:bg-(--surface-2)`}
        >
          <BookIcon className="h-4 w-4" />
          সব মাসআলা
        </Link>
      </div>

      <RelatedMasail items={related} />
    </MasailShell>
  );
}
