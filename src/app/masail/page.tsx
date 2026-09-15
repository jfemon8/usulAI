import type { Metadata } from "next";
import Link from "next/link";
import { MasailShell } from "@/components/masail/MasailChrome";
import { MasailFeed } from "@/components/masail/MasailFeed";
import { HELP_CONFIG, MASAIL_CONFIG } from "@/config/site";
import { listPublishedMasail, type MasalaSummary } from "@/lib/analytics/verifiedAnswers";
import { withTimeout } from "@/lib/site/siteContent";
import { logger } from "@/lib/utils/logger";

export const revalidate = 300;

const LOAD_TIMEOUT_MS = 5_000;
const DESCRIPTION =
  "আলেমদের যাচাই করা ও প্রকাশিত মাসআলা, কুরআন, হাদিস ও ফিকহের দলিলসহ। প্রশ্নের শব্দ লিখে খুঁজুন।";

export const metadata: Metadata = {
  title: "মাসআলা",
  description: DESCRIPTION,
  alternates: { canonical: MASAIL_CONFIG.path },
  openGraph: { title: "মাসআলা", description: DESCRIPTION, url: MASAIL_CONFIG.path },
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

export default async function MasailPage() {
  const page = await firstPage();

  return (
    <MasailShell>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-(--text-1) sm:text-3xl">
          মাসআলা
        </h1>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-(--text-2) sm:text-base sm:leading-7">
          আলেমদের লেখা ও যাচাই করা উত্তর, দলিলসহ। আপনার প্রশ্নের উত্তর না পেলে{" "}
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
      <MasailFeed
        initialItems={page.items}
        initialCursor={page.nextCursor}
        unavailable={page.unavailable}
      />
    </MasailShell>
  );
}
