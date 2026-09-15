"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { BookIcon, PenIcon, QuestionIcon } from "@/components/ui/Icons";
import { HELP_CONFIG, MASAIL_CONFIG } from "@/config/site";

const LINKS = [
  { href: MASAIL_CONFIG.path, label: "মাসআলা", icon: BookIcon },
  { href: HELP_CONFIG.path, label: "আমার প্রশ্ন", icon: QuestionIcon },
  { href: "/", label: "চ্যাট", icon: PenIcon },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="প্রধান মেনু" className="flex items-center gap-0.5">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            title={link.label}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm transition",
              active
                ? "bg-(--accent-soft) font-medium text-(--accent)"
                : "text-(--text-2) hover:bg-(--surface-2) hover:text-(--text-1)",
            )}
          >
            <link.icon className="h-4 w-4 shrink-0" />
            <span className="sr-only min-[440px]:not-sr-only">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
