"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import {
  Badge,
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
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList, type VirtualColumn } from "@/components/admin/VirtualList";
import { CloseIcon, PenIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/ui/Icons";

export interface AnswerSummary {
  id: string;
  question: string;
  origin: "scholar" | "auto";
  servedCount: number;
  sourceCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  author: { name: string; category: string } | null;
  published: boolean;
}

interface ListResponse {
  items: AnswerSummary[];
  total: number;
  nextCursor: string | null;
}

type OriginFilter = "" | "scholar" | "auto";

export function OriginBadge({ origin }: { origin: "scholar" | "auto" }) {
  return origin === "auto" ? (
    <Badge tone="warn">স্বয়ংক্রিয়</Badge>
  ) : (
    <Badge tone="accent">আলেমের অনুমোদিত</Badge>
  );
}

function listPath(query: string, origin: OriginFilter, cursor: string | null): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (origin) params.set("origin", origin);
  if (cursor) params.set("cursor", cursor);
  const search = params.toString();
  return `/api/admin/answers${search ? `?${search}` : ""}`;
}

function WhenCell({ value }: { value: string | null }) {
  const text = formatWhen(value);
  const split = text.lastIndexOf(", ");
  if (split < 0) return <span className="whitespace-nowrap">{text}</span>;
  return (
    <span className="flex flex-col tabular-nums">
      <span className="whitespace-nowrap">{text.slice(0, split)}</span>
      <span className="text-xs whitespace-nowrap text-(--text-3)">{text.slice(split + 2)}</span>
    </span>
  );
}

function revealListTop(element: HTMLElement | null) {
  if (!element) return;
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  if (element.getBoundingClientRect().top >= margin) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

export function AnswerList() {
  const router = useRouter();
  const toast = useToast();
  const listTop = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<OriginFilter>("");
  const [pendingDelete, setPendingDelete] = useState<AnswerSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const closeDelete = useCallback(() => setPendingDelete(null), []);

  const list = useInfiniteAdminData<ListResponse, AnswerSummary>({
    key: JSON.stringify([query, origin]),
    path: (cursor) => listPath(query, origin, cursor),
    items: (page) => page.items,
    next: (page) => page.nextCursor,
  });
  const { items, firstPage, error, loading, setPages } = list;
  const filtered = Boolean(query || origin);

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(typed.trim());
    revealListTop(listTop.current);
  }

  function clearSearch() {
    setTyped("");
    setQuery("");
    revealListTop(listTop.current);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const removed = pendingDelete.id;
    setDeleting(true);
    try {
      await adminApi(`/api/admin/answers/${removed}`, { method: "DELETE" });
      toast.success("যাচাইকৃত উত্তরটি মুছে ফেলা হয়েছে।");
      setPendingDelete(null);
      setPages((pages) => {
        if (!pages.some((page) => page.items.some((item) => item.id === removed))) return pages;
        return pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.id !== removed),
          total: Math.max(0, page.total - 1),
        }));
      });
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setDeleting(false);
    }
  }

  const columns: VirtualColumn<AnswerSummary>[] = [
    {
      key: "question",
      label: "প্রশ্ন",
      primary: true,
      width: "minmax(0, 1fr)",
      render: (row) => (
        <Link
          href={`/admin/answers/${row.id}`}
          dir="auto"
          className="font-medium break-words text-(--text-1) hover:text-(--accent)"
          onClick={(event) => event.stopPropagation()}
        >
          {row.question}
        </Link>
      ),
    },
    {
      key: "origin",
      label: "ধরন",
      width: "8.5rem",
      render: (row) => <OriginBadge origin={row.origin} />,
    },
    {
      key: "author",
      label: "লেখক",
      width: "8.5rem",
      className: "break-words",
      render: (row) =>
        row.author ? (
          <span className="flex flex-col gap-1">
            <span>
              {row.author.category} {row.author.name}
            </span>
            {row.published ? <Badge tone="accent">প্রকাশিত</Badge> : null}
          </span>
        ) : (
          <span className="text-(--text-3)">নেই</span>
        ),
    },
    {
      key: "served",
      label: "দেখানো হয়েছে",
      width: "4.75rem",
      className: "whitespace-nowrap tabular-nums",
      render: (row) => `${formatCount(row.servedCount)} বার`,
    },
    {
      key: "sources",
      label: "সূত্র",
      width: "3rem",
      className: "whitespace-nowrap tabular-nums",
      render: (row) => `${formatCount(row.sourceCount)}টি`,
    },
    {
      key: "created",
      label: "তৈরি",
      width: "8.5rem",
      render: (row) => <WhenCell value={row.createdAt} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="যাচাইকৃত উত্তর"
        description="এই তালিকার প্রশ্ন হুবহু বা একই বিষয়ে এলে মডেল না ডেকে সংরক্ষিত উত্তর ও সূত্র দেখানো হয়।"
        actions={
          <Button
            tone="primary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => router.push("/admin/answers/new")}
          >
            নতুন উত্তর
          </Button>
        }
      />

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
                    onClick={clearSearch}
                    className="absolute end-0.5 top-1/2 h-9 w-9 -translate-y-1/2"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </IconButton>
                ) : null}
              </div>
              <Button type="submit">খুঁজুন</Button>
            </form>
            <Select
              aria-label="ধরন অনুযায়ী ছাঁকুন"
              value={origin}
              onChange={(event) => {
                const value = event.target.value;
                setOrigin(value === "auto" || value === "scholar" ? value : "");
                revealListTop(listTop.current);
              }}
              className="sm:w-52"
            >
              <option value="">সব ধরন</option>
              <option value="scholar">আলেমের অনুমোদিত</option>
              <option value="auto">স্বয়ংক্রিয়</option>
            </Select>
          </div>

          <div className="p-3 sm:p-4" aria-busy={loading}>
            {!firstPage && error ? (
              <LoadError message={error} onRetry={list.retry} />
            ) : !firstPage ? (
              <Skeleton rows={5} />
            ) : items.length === 0 && !list.hasMore ? (
              <EmptyState title={filtered ? "কিছু পাওয়া যায়নি" : "কোনো যাচাইকৃত উত্তর নেই"}>
                {filtered
                  ? "অন্য শব্দে খুঁজে দেখুন বা ছাঁকনি বদলান।"
                  : "নতুন উত্তর যোগ করুন, অথবা পাঠকদের সমর্থিত উত্তর স্বয়ংক্রিয়ভাবে এখানে আসবে।"}
              </EmptyState>
            ) : (
              <>
                <p className="mb-3 text-xs text-(--text-3) tabular-nums">
                  মোট {formatCount(firstPage.total)}টি উত্তর
                  {items.length < firstPage.total
                    ? ` · ${formatCount(items.length)}টি দেখানো হচ্ছে`
                    : null}
                </p>
                <VirtualDataList
                  rows={items}
                  columns={columns}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => router.push(`/admin/answers/${row.id}`)}
                  estimateRowHeight={66}
                  estimateCardHeight={220}
                  actionsWidth="5.25rem"
                  hasMore={list.hasMore}
                  loadingMore={list.loadingMore}
                  error={error}
                  onLoadMore={list.loadMore}
                  onRetry={list.retry}
                  endLabel="সব উত্তর দেখানো হয়েছে"
                  actions={(row) => (
                    <>
                      <IconButton
                        label="সম্পাদনা"
                        onClick={() => router.push(`/admin/answers/${row.id}`)}
                      >
                        <PenIcon className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="মুছুন"
                        onClick={() => setPendingDelete(row)}
                        className="hover:text-(--danger)"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </>
                  )}
                />
              </>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="উত্তরটি মুছে ফেলবেন?"
        message={
          <>
            <span className="block font-medium text-(--text-1)">{pendingDelete?.question}</span>
            <span className="mt-2 block">
              মুছে ফেললে এই প্রশ্নে আবার মডেল দিয়ে নতুন উত্তর তৈরি হবে। এটি ফেরত আনা যাবে না।
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
