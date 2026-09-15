import Link from "next/link";
import type { ReactNode } from "react";
import { PublicNav } from "@/components/site/PublicNav";
import { LogoMark } from "@/components/ui/Logo";
import { SITE_NAME } from "@/config/site";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-(--bg) text-(--text-1)">
      <header className="sticky top-0 z-40 border-b border-(--border) bg-(--bg)/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-lg py-1 pe-2 transition hover:opacity-80"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-(--accent)">
              <LogoMark className="h-full w-full" />
            </span>
            <span className="truncate text-[0.9375rem] font-semibold tracking-tight">
              {SITE_NAME}
            </span>
          </Link>
          <PublicNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:pt-8">
        {children}
      </main>
    </div>
  );
}
