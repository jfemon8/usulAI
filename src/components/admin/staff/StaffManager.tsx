"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { PageHeader, formatCount } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { AccountsTab } from "@/components/admin/staff/AccountsTab";
import { CategoriesTab } from "@/components/admin/staff/CategoriesTab";
import { CORE_DATA_NOTE, type CategoryView } from "@/components/admin/staff/shared";

export type StaffTab = "accounts" | "categories";

const TABS: { id: StaffTab; label: string }[] = [
  { id: "accounts", label: "অ্যাকাউন্ট" },
  { id: "categories", label: "ক্যাটাগরি" },
];

export function StaffManager({ initialTab }: { initialTab: StaffTab }) {
  const [tab, setTab] = useState<StaffTab>(initialTab);
  const categories = useAdminData<{ items: CategoryView[] }>("/api/admin/staff/categories");
  const { reload, replace } = categories;

  const selectTab = useCallback((next: StaffTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "accounts") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const replaceItems = useCallback((items: CategoryView[]) => replace({ items }), [replace]);

  return (
    <>
      <PageHeader
        title="স্টাফ ও ক্যাটাগরি"
        description={`মডারেটর ও আলেমদের অ্যাকাউন্ট তৈরি, স্থগিত, পাসওয়ার্ড রিসেট ও ক্যাটাগরি ব্যবস্থাপনা। ${CORE_DATA_NOTE}`}
      />

      <div
        role="tablist"
        aria-label="স্টাফ ব্যবস্থাপনা"
        className="mb-4 inline-flex w-full rounded-xl border border-(--border) bg-(--surface-2) p-1 sm:w-auto"
      >
        {TABS.map((entry) => {
          const selected = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`staff-tab-${entry.id}`}
              aria-selected={selected}
              aria-controls={`staff-panel-${entry.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(entry.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const next = entry.id === "accounts" ? "categories" : "accounts";
                selectTab(next);
                document.getElementById(`staff-tab-${next}`)?.focus();
              }}
              className={clsx(
                "h-10 flex-1 rounded-lg px-4 text-sm font-medium transition sm:flex-none",
                selected
                  ? "bg-(--bg) text-(--text-1) shadow-sm"
                  : "text-(--text-2) hover:text-(--text-1)",
              )}
            >
              {entry.label}
              {entry.id === "categories" && categories.data ? (
                <span className="ms-1.5 text-xs text-(--text-3) tabular-nums">
                  {formatCount(categories.data.items.length)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`staff-panel-${tab}`} aria-labelledby={`staff-tab-${tab}`}>
        {tab === "accounts" ? (
          <AccountsTab
            categories={categories.data?.items ?? null}
            categoriesError={categories.error}
            onCategoriesChanged={reload}
          />
        ) : (
          <CategoriesTab
            categories={categories.data?.items ?? null}
            error={categories.error}
            loading={categories.loading}
            onReload={reload}
            onReplace={replaceItems}
          />
        )}
      </div>
    </>
  );
}
