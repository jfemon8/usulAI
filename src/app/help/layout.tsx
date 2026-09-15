import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { HELP_CONFIG, SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: { default: "আলেমের কাছে প্রশ্ন", template: `%s · ${SITE_NAME}` },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-(--bg) text-(--text-1)">
      <header className="sticky top-0 z-40 border-b border-(--border) bg-(--bg)/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-lg py-1 pe-2 text-(--text-1) transition hover:opacity-80"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-(--accent)">
              <LogoMark className="h-full w-full" />
            </span>
            <span className="truncate text-[0.9375rem] font-semibold">{SITE_NAME}</span>
          </Link>
          <nav className="ms-auto flex items-center gap-1 text-sm">
            <Link
              href={HELP_CONFIG.path}
              className="rounded-lg px-2.5 py-2 text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1)"
            >
              আমার প্রশ্নগুলো
            </Link>
            <Link
              href="/"
              className="rounded-lg px-2.5 py-2 text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1)"
            >
              চ্যাট
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-8">
        {children}
      </main>
    </div>
  );
}
