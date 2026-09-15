import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { SITE_NAME } from "@/config/site";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-(--sidebar-bg) px-4 py-[max(2rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center text-(--accent)">
            <LogoMark className="h-full w-full" />
          </span>
          <span className="text-lg font-semibold text-(--text-1)">{SITE_NAME}</span>
        </Link>
        <section className="rounded-3xl border border-(--border) bg-(--bg) px-5 py-6 shadow-(--composer-shadow) sm:px-8 sm:py-8">
          <h1 className="text-xl font-semibold tracking-tight text-(--text-1) sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-sm leading-6 text-(--text-3)">{description}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </section>
        {footer ? <div className="mt-5 text-center text-sm text-(--text-3)">{footer}</div> : null}
      </div>
    </main>
  );
}
