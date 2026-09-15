"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import { AuthorLine, PublishBadge } from "@/components/admin/masail/MasalaFields";
import type {
  AuthorCount,
  WorkspaceMasala,
  WorkspaceMasalaDetail,
  WorkspacePage,
} from "@/components/admin/masail/types";
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  LoadError,
  PageHeader,
  Select,
  Skeleton,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList, type VirtualColumn } from "@/components/admin/VirtualList";
import {
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  PenIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import type { PrincipalView } from "@/lib/admin/roles";

type Tab = "mine" | "all" | "published";

const TAB_LABELS: Record<Tab, string> = {
  mine: "আমার মাসআলা",
  all: "সব",
  published: "সব প্রকাশিত",
};

function listPath(tab: Tab, query: string, author: string, cursor: string | null): string {
  const params = new URLSearchParams({ tab });
  if (query) params.set("q", query);
  if (tab === "all" && author) params.set("author", author);
  if (cursor) params.set("cursor", cursor);
  return `/api/admin/masail?${params.toString()}`;
}

export function MasailWorkspace({ principal }: { principal: PrincipalView }) {
  const router = useRouter();
  const toast = useToast();
  const listTop = useRef<HTMLDivElement>(null);
  const isAdmin = principal.permissions.includes("masail.override");
  const tabs: Tab[] = isAdmin ? ["mine", "all", "published"] : ["mine", "published"];
  const [tab, setTab] = useState<Tab>("mine");
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [pendingDelete, setPendingDelete] = useState<WorkspaceMasala | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const closeDelete = useCallback(() => setPendingDelete(null), []);

  const authors = useAdminData<{ authors: AuthorCount[] }>(
    isAdmin ? "/api/admin/masail/authors" : null,
  );

  const list = useInfiniteAdminData<WorkspacePage, WorkspaceMasala>({
    key: JSON.stringify([tab, query, tab === "all" ? author : ""]),
    path: (cursor) => listPath(tab, query, author, cursor),
    items: (page) => page.items,
    next: (page) => page.nextCursor,
  });
  const { items, firstPage, error, setPages } = list;
  const filtered = Boolean(query || (tab === "all" && author));

  function reveal() {
    const element = listTop.current;
    if (!element || element.getBoundingClientRect().top >= 0) return;
    element.scrollIntoView({ block: "start" });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(typed.trim());
    reveal();
  }

  function replaceRow(detail: WorkspaceMasalaDetail) {
    setPages((pages) =>
      pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === detail.id
            ? {
                ...item,
                published: detail.published,
                publishedAt: detail.publishedAt,
                updatedAt: detail.updatedAt,
                path: detail.path,
              }
            : item,
        ),
      })),
    );
  }

  async function togglePublished(row: WorkspaceMasala) {
    setToggling(row.id);
    try {
      const detail = await adminApi<WorkspaceMasalaDetail>(`/api/admin/masail/${row.id}`, {
        method: "PATCH",
        body: { published: !row.published },
      });
      if (tab === "published" && !detail.published) {
        setPages((pages) =>
          pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== row.id),
            total: page.total === null ? null : Math.max(0, page.total - 1),
          })),
        );
      } else {
        replaceRow(detail);
      }
      toast.success(
        detail.published ? "মাসআলাটি প্রকাশ করা হয়েছে।" : "মাসআলাটি অপ্রকাশিত করা হয়েছে।",
      );
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setToggling(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const removed = pendingDelete.id;
    setDeleting(true);
    try {
      await adminApi(`/api/admin/masail/${removed}`, { method: "DELETE" });
      toast.success("মাসআলাটি মুছে ফেলা হয়েছে।");
      setPendingDelete(null);
      setPages((pages) =>
        pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.id !== removed),
          total: page.total === null ? null : Math.max(0, page.total - 1),
        })),
      );
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setDeleting(false);
    }
  }

  const columns: VirtualColumn<WorkspaceMasala>[] = [
    {
      key: "question",
      label: "প্রশ্ন",
      primary: true,
      width: "minmax(0, 1fr)",
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/masail/${row.id}`}
            dir="auto"
            className="font-medium break-words text-(--text-1) hover:text-(--accent)"
            onClick={(event) => event.stopPropagation()}
          >
            {row.question}
          </Link>
          {row.excerpt ? (
            <p className="mt-1 line-clamp-2 text-xs break-words text-(--text-3)" dir="auto">
              {row.excerpt}
            </p>
          ) : null}
        </div>
      ),
    },
    ...(tab === "mine"
      ? []
      : [
          {
            key: "author",
            label: "লেখক",
            width: "9rem",
            render: (row: WorkspaceMasala) => <AuthorLine author={row.author} />,
          },
        ]),
    {
      key: "status",
      label: "অবস্থা",
      width: "6rem",
      render: (row) => <PublishBadge published={row.published} />,
    },
    {
      key: "served",
      label: "দেখানো",
      width: "4.5rem",
      className: "whitespace-nowrap tabular-nums",
      render: (row) => `${formatCount(row.servedCount)} বার`,
    },
    {
      key: "updated",
      label: "হালনাগাদ",
      width: "8.5rem",
      className: "text-xs text-(--text-2)",
      render: (row) => formatWhen(row.updatedAt ?? row.createdAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="মাসআলা ও ফতোয়া"
        description="আপনার লেখা মাসআলা যাচাইকৃত উত্তর হিসেবে সংরক্ষিত হয়। একই প্রশ্ন এলে চ্যাটে আপনার নামসহ দেখানো হয়, আর প্রকাশ করলে পাবলিক মাসআলা পাতায় আসে। AI এগুলোকে দলিল হিসেবে উদ্ধৃত করে না।"
        actions={
          <Button
            tone="primary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => router.push("/admin/masail/new")}
          >
            নতুন মাসআলা
          </Button>
        }
      />

      <div
        role="tablist"
        aria-label="মাসআলার তালিকা"
        className="thin-scroll mb-4 flex gap-1 overflow-x-auto rounded-xl bg-(--surface-2) p-1 sm:inline-flex"
      >
        {tabs.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            onClick={() => {
              setTab(entry);
              reveal();
            }}
            className={clsx(
              "h-9 flex-1 rounded-lg px-3 text-sm whitespace-nowrap transition sm:flex-none",
              tab === entry
                ? "bg-(--bg) font-medium text-(--text-1) shadow-sm"
                : "text-(--text-2) hover:text-(--text-1)",
            )}
          >
            {TAB_LABELS[entry]}
          </button>
        ))}
      </div>

      <div ref={listTop} className="scroll-mt-16 lg:scroll-mt-4">
        <Card padded={false}>
          <div className="flex flex-col gap-2 border-b border-(--border) p-3 sm:flex-row sm:p-4">
            <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2" role="search">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-3)" />
                <Input
                  aria-label="প্রশ্নে খুঁজুন"
                  placeholder="প্রশ্নের অংশ লিখে খুঁজুন"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  className="ps-9 pe-10"
                />
                {typed ? (
                  <IconButton
                    label="খোঁজা মুছুন"
                    onClick={() => {
                      setTyped("");
                      setQuery("");
                    }}
                    className="absolute end-0.5 top-1/2 h-9 w-9 -translate-y-1/2"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </IconButton>
                ) : null}
              </div>
              <Button type="submit">খুঁজুন</Button>
            </form>
            {tab === "all" ? (
              <Select
                aria-label="লেখক অনুযায়ী ছাঁকুন"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                className="sm:w-56"
              >
                <option value="">সব লেখক</option>
                {(authors.data?.authors ?? []).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.category} {entry.name} ({formatCount(entry.count)})
                  </option>
                ))}
              </Select>
            ) : null}
          </div>

          <div className="p-3 sm:p-4" aria-busy={list.loading}>
            {!firstPage && error ? (
              <LoadError message={error} onRetry={list.retry} />
            ) : !firstPage ? (
              <Skeleton rows={5} />
            ) : items.length === 0 && !list.hasMore ? (
              <EmptyState title={filtered ? "কিছু পাওয়া যায়নি" : "কোনো মাসআলা নেই"}>
                {filtered
                  ? "অন্য শব্দে খুঁজে দেখুন বা ছাঁকনি বদলান।"
                  : tab === "mine"
                    ? "নতুন মাসআলা লিখুন, অথবা উত্তর রিভিউ থেকে AI এর উত্তর সংশোধন করে সংরক্ষণ করুন।"
                    : "এখনো কোনো মাসআলা নেই।"}
              </EmptyState>
            ) : (
              <>
                {firstPage.total !== null ? (
                  <p className="mb-3 text-xs text-(--text-3) tabular-nums">
                    মোট {formatCount(firstPage.total)}টি মাসআলা
                  </p>
                ) : null}
                <VirtualDataList
                  rows={items}
                  columns={columns}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => router.push(`/admin/masail/${row.id}`)}
                  estimateRowHeight={84}
                  estimateCardHeight={230}
                  actionsWidth="7.75rem"
                  hasMore={list.hasMore}
                  loadingMore={list.loadingMore}
                  error={error}
                  onLoadMore={list.loadMore}
                  onRetry={list.retry}
                  endLabel="সব মাসআলা দেখানো হয়েছে"
                  actions={(row) =>
                    row.canEdit ? (
                      <>
                        <IconButton
                          label="সম্পাদনা"
                          onClick={() => router.push(`/admin/masail/${row.id}`)}
                        >
                          <PenIcon className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={row.published ? "অপ্রকাশিত করুন" : "প্রকাশ করুন"}
                          disabled={toggling === row.id}
                          onClick={() => void togglePublished(row)}
                        >
                          {row.published ? (
                            <EyeOffIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </IconButton>
                        <IconButton
                          label="মুছুন"
                          onClick={() => setPendingDelete(row)}
                          className="hover:text-(--danger)"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        label="দেখুন"
                        onClick={() => router.push(`/admin/masail/${row.id}`)}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </IconButton>
                    )
                  }
                />
              </>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="মাসআলাটি মুছে ফেলবেন?"
        message={
          <>
            <span className="block font-medium break-words text-(--text-1)" dir="auto">
              {pendingDelete?.question}
            </span>
            <span className="mt-2 block">
              মুছে ফেললে চ্যাটে এই প্রশ্নের উত্তর আবার AI তৈরি করবে এবং প্রকাশিত পাতা থেকেও সরে
              যাবে। এটি ফেরত আনা যাবে না।
            </span>
          </>
        }
        confirmLabel="মুছে ফেলুন"
        busy={deleting}
        onClose={closeDelete}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
