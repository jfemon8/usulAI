"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { clsx } from "clsx";
import { adminApi } from "@/components/admin/api";
import { ToastProvider } from "@/components/admin/Dialog";
import { IconButton } from "@/components/admin/ui";
import {
  BadgeCheckIcon,
  BookIcon,
  CloseIcon,
  DashboardIcon,
  DatabaseIcon,
  FolderIcon,
  HomeIcon,
  LayoutIcon,
  ListIcon,
  LogoutIcon,
  MenuIcon,
  QuranIcon,
  SparklesIcon,
  UserIcon,
} from "@/components/ui/Icons";
import { LogoMark } from "@/components/ui/Logo";
import { ADMIN_CONFIG, SITE_NAME } from "@/config/site";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const ADMIN_NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "সারসংক্ষেপ",
    items: [{ href: "/admin", label: "ড্যাশবোর্ড", icon: DashboardIcon }],
  },
  {
    title: "কনটেন্ট",
    items: [
      { href: "/admin/corpus", label: "দলিল ভান্ডার", icon: BookIcon },
      { href: "/admin/answers", label: "যাচাইকৃত উত্তর", icon: BadgeCheckIcon },
      { href: "/admin/notes", label: "কুরআনের নোট", icon: QuranIcon },
      { href: "/admin/site", label: "সাইট কনটেন্ট", icon: LayoutIcon },
      { href: "/admin/ai", label: "AI সেটিংস", icon: SparklesIcon },
    ],
  },
  {
    title: "রিসোর্স",
    items: [
      { href: "/admin/files", label: "ফাইল (Cloudinary)", icon: FolderIcon },
      { href: "/admin/database", label: "ডাটাবেস", icon: DatabaseIcon },
    ],
  },
  {
    title: "নিরাপত্তা",
    items: [
      { href: "/admin/audit", label: "অডিট লগ", icon: ListIcon },
      { href: "/admin/account", label: "অ্যাকাউন্ট", icon: UserIcon },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-(--accent)">
        <LogoMark className="h-full w-full" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem] leading-5 font-semibold text-(--text-1)">
          {SITE_NAME}
        </span>
        <span className="block text-xs leading-4 text-(--text-3)">অ্যাডমিন প্যানেল</span>
      </span>
    </Link>
  );
}

function Navigation({
  pathname,
  email,
  onNavigate,
  onLogout,
  loggingOut,
}: {
  pathname: string;
  email: string;
  onNavigate: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <nav
        className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3"
        aria-label="অ্যাডমিন মেনু"
      >
        {ADMIN_NAV.map((group) => (
          <div key={group.title} className="mt-4 first:mt-1">
            <p className="px-3 pb-1.5 text-xs font-medium text-(--text-3)">{group.title}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                        active
                          ? "bg-(--accent-soft) font-medium text-(--accent)"
                          : "text-(--text-2) hover:bg-(--surface-2) hover:text-(--text-1)",
                      )}
                    >
                      <item.icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-(--border) p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href="/"
          className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1)"
        >
          <HomeIcon className="h-[1.125rem] w-[1.125rem]" />
          সাইটে ফিরুন
        </Link>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-(--surface-2) py-2 ps-3 pe-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-(--text-3)">লগইন করা আছে</p>
            <p className="truncate text-sm text-(--text-1)" title={email}>
              {email}
            </p>
          </div>
          <IconButton label="লগআউট" onClick={onLogout} disabled={loggingOut}>
            <LogoutIcon className="h-[1.125rem] w-[1.125rem]" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [drawerPath, setDrawerPath] = useState(pathname);

  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const current = ADMIN_NAV.flatMap((group) => group.items).find((item) =>
    isActive(pathname, item.href),
  );

  async function logout() {
    setLoggingOut(true);
    try {
      await adminApi("/api/admin/auth/logout", { method: "POST", body: {} });
    } finally {
      router.replace(ADMIN_CONFIG.paths.login);
      router.refresh();
    }
  }

  const navigation = (
    <Navigation
      pathname={pathname}
      email={email}
      onNavigate={() => setDrawerOpen(false)}
      onLogout={() => void logout()}
      loggingOut={loggingOut}
    />
  );

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-(--sidebar-bg) lg:flex">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-(--border) bg-(--sidebar-bg) lg:flex">
          <div className="flex h-16 shrink-0 items-center px-5">
            <Brand />
          </div>
          {navigation}
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="মেনু বন্ধ করুন"
              className="absolute inset-0 bg-black/45"
              onClick={() => setDrawerOpen(false)}
            />
            <aside
              className="absolute inset-y-0 left-0 flex w-[min(19rem,86vw)] flex-col bg-(--sidebar-bg) shadow-2xl"
              style={{ animation: "drawer-in 0.24s cubic-bezier(0.32, 0.72, 0, 1) both" }}
              aria-label="অ্যাডমিন মেনু"
            >
              <div className="flex h-14 shrink-0 items-center justify-between ps-4 pe-2 pt-[env(safe-area-inset-top)]">
                <Brand />
                <IconButton label="মেনু বন্ধ করুন" onClick={() => setDrawerOpen(false)}>
                  <CloseIcon className="h-5 w-5" />
                </IconButton>
              </div>
              {navigation}
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-(--border) bg-(--bg)/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
            <IconButton label="মেনু খুলুন" onClick={() => setDrawerOpen(true)}>
              <MenuIcon className="h-5 w-5" />
            </IconButton>
            <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-(--text-1)">
              {current?.label ?? "অ্যাডমিন"}
            </p>
            <span className="me-2 flex h-7 w-7 items-center justify-center text-(--accent)">
              <LogoMark className="h-full w-full" />
            </span>
          </header>

          <main className="min-w-0 flex-1 bg-(--bg) px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:rounded-s-3xl lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
