import type { Metadata } from "next";
import Link from "next/link";
import { MasailShell } from "@/components/masail/MasailChrome";
import { MasailFeed } from "@/components/masail/MasailFeed";
import { HELP_CONFIG, MASAIL_CONFIG } from "@/config/site";
import { listPublishedMasail, type MasalaSummary } from "@/lib/analytics/verifiedAnswers";
import { listMasailCategories, publishedCategoryCounts } from "@/lib/masail/categories";
import { withTimeout } from "@/lib/site/siteContent";
import { logger } from "@/lib/utils/logger";

export const revalidate = 300;

const LOAD_TIMEOUT_MS = 5_000;
const DESCRIPTION =
  "আলেমদের যাচাই করা ও প্রকাশিত মাসআলা, কুরআন, হাদিস ও ফিকহের দলিলসহ। প্রশ্নের শব্দ লিখে খুঁজুন।";

const TITLE = "মাসআলা ও ফতোয়া: দলিলসহ বাংলা ইসলামিক প্রশ্নোত্তর";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: MASAIL_CONFIG.path },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: MASAIL_CONFIG.path },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

async function firstPage(): Promise<{
  items: MasalaSummary[];
  nextCursor: string | null;
  unavailable: boolean;
}> {
  try {
    const page = await withTimeout(listPublishedMasail({}), LOAD_TIMEOUT_MS);
    return { ...page, unavailable: false };
  } catch (error) {
    logger.warn("Masail page could not load the first page", {
      error: String(error).slice(0, 160),
    });
    return { items: [], nextCursor: null, unavailable: true };
  }
}

async function topics() {
  try {
    const [items, counts] = await Promise.all([listMasailCategories(), publishedCategoryCounts()]);
    return items
      .map((item) => ({ ...item, count: counts[item.slug] ?? 0 }))
      .filter((item) => item.count > 0);
  } catch {
    return [];
  }
}

export default async function MasailPage() {
  const [page, categories] = await Promise.all([firstPage(), topics()]);

  return (
    <MasailShell>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-(--text-1) sm:text-3xl">
          মাসআলা ও ফতোয়া
        </h1>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-(--text-2) sm:text-base sm:leading-7">
          নামাজ, রোজা, যাকাত, হজ, পবিত্রতা, লেনদেন ও পারিবারিক বিষয়সহ দৈনন্দিন জীবনের মাসআলা।
          প্রতিটি উত্তর আলেমদের লেখা ও যাচাই করা, সাথে কুরআন, হাদিস, ইজমা, কিয়াস ও ফিকহের দলিল।
          আপনার প্রশ্নের উত্তর না পেলে{" "}
          <Link
            href={HELP_CONFIG.path}
            className="font-medium text-(--accent) underline-offset-4 hover:underline"
          >
            আলেমের কাছে প্রশ্ন পাঠান
          </Link>{" "}
          অথবা{" "}
          <Link href="/" className="font-medium text-(--accent) underline-offset-4 hover:underline">
            চ্যাটে জিজ্ঞেস করুন
          </Link>
          ।
        </p>
      </div>
      {categories.length > 0 ? (
        <nav aria-label="বিষয়" className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={category.path}
              className="inline-flex items-center gap-1.5 rounded-full border border-(--border) px-3 py-1.5 text-sm text-(--text-2) transition hover:border-(--border-strong) hover:text-(--text-1)"
            >
              {category.name}
              <span className="text-xs text-(--text-3)">{category.count}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      <MasailFeed
        initialItems={page.items}
        initialCursor={page.nextCursor}
        unavailable={page.unavailable}
      />
    </MasailShell>
  );
}
