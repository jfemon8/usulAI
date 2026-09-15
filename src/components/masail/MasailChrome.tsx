import Link from "next/link";
import type { ReactNode } from "react";
import { BookIcon, PenIcon, QuestionIcon } from "@/components/ui/Icons";
import { LogoMark } from "@/components/ui/Logo";
import { HELP_CONFIG, MASAIL_CONFIG, SITE_NAME } from "@/config/site";
import type { MasalaAuthor } from "@/lib/analytics/verifiedAnswers";
import { formatTimestamp } from "@/lib/utils/dateTime";

export function authorLabel(author: MasalaAuthor | null): string | null {
  if (!author) return null;
  return [author.category, author.name].filter((part) => part.trim()).join(" ") || null;
}

export function publishedLabel(value: string | null): string | null {
  return value ? formatTimestamp(value) : null;
}

const NAV_LINK =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1)";

export function MasailShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-(--bg) text-(--text-1)">
      <header className="sticky top-0 z-30 border-b border-(--border) bg-(--bg)/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-(--accent)">
              <LogoMark className="h-full w-full" />
            </span>
            <span className="truncate text-[0.9375rem] font-semibold tracking-tight">
              {SITE_NAME}
            </span>
          </Link>
          <nav aria-label="মাসআলা মেনু" className="flex items-center gap-0.5">
            <Link href={MASAIL_CONFIG.path} className={NAV_LINK}>
              <BookIcon className="h-4 w-4" />
              <span className="hidden min-[400px]:inline">মাসআলা</span>
            </Link>
            <Link href={HELP_CONFIG.path} className={NAV_LINK}>
              <QuestionIcon className="h-4 w-4" />
              <span className="hidden min-[400px]:inline">প্রশ্ন পাঠান</span>
            </Link>
            <Link href="/" className={NAV_LINK}>
              <PenIcon className="h-4 w-4" />
              <span className="hidden sm:inline">চ্যাট</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:pt-8">
        {children}
      </main>
    </div>
  );
}
