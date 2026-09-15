"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { clsx } from "clsx";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  LoadError,
  PageHeader,
  Skeleton,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList, type VirtualColumn } from "@/components/admin/VirtualList";
import { CloseIcon, SearchIcon } from "@/components/ui/Icons";
import {
  HELP_CLOSE_REASON_LABELS,
  HELP_FILTER_LABELS,
  type HelpFilter,
  type HelpListResponse,
  type HelpSummary,
} from "@/lib/help/types";

function listPath(filter: HelpFilter, query: string, cursor: string | null): string {
  const params = new URLSearchParams({ filter });
  if (query) params.set("q", query);
  if (cursor) params.set("cursor", cursor);
  return `/api/admin/help?${params.toString()}`;
}

export function HelpStatusCell({ row }: { row: HelpSummary }) {
  if (row.status === "answered") return <Badge tone="accent">উত্তর দেওয়া</Badge>;
  if (row.status === "closed") return <Badge>বন্ধ</Badge>;
  if (row.claim) {
    return (
      <span className="flex flex-col items-start gap-1">
        <Badge tone={row.claim.mine ? "accent" : "neutral"}>
          {row.claim.mine ? "আমি দেখছি" : "দেখা হচ্ছে"}
        </Badge>
        {!row.claim.mine ? (
          <span className="text-xs break-words text-(--text-3)">
            {row.claim.category} {row.claim.name}
          </span>
        ) : null}
      </span>
    );
  }
  return <Badge tone="warn">অপেক্ষমাণ</Badge>;
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

const BASE_FILTERS: HelpFilter[] = ["open", "claimed", "answered", "closed", "all"];

export function HelpList() {
  const router = useRouter();
  const listTop = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HelpFilter>("open");

  const list = useInfiniteAdminData<HelpListResponse, HelpSummary>({
    key: JSON.stringify([filter, query]),
    path: (cursor) => listPath(filter, query, cursor),
    items: (page) => page.items,
    next: (page) => page.nextCursor,
  });
  const { items, firstPage, error, loading } = list;
  const viewer = firstPage?.viewer;
  const stats = firstPage?.stats;
  const filters: HelpFilter[] = viewer?.canHandle
    ? ["open", "mine", "claimed", "answered", "closed", "all"]
    : BASE_FILTERS;

  function choose(next: HelpFilter) {
    setFilter(next);
    revealListTop(listTop.current);
  }

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

  const columns: VirtualColumn<HelpSummary>[] = [
    {
      key: "question",
      label: "প্রশ্ন",
      primary: true,
      width: "minmax(0, 1fr)",
      render: (row) => (
        <span className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/admin/help/${row.id}`}
            dir="auto"
            className="line-clamp-3 font-medium break-words text-(--text-1) hover:text-(--accent)"
            onClick={(event) => event.stopPropagation()}
          >
            {row.question}
          </Link>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--text-3)">
            {row.hasContext ? <span>AI উত্তরসহ</span> : null}
            {row.answeredBy ? (
              <span>
                উত্তর: {row.answeredBy.category} {row.answeredBy.name}
              </span>
            ) : null}
            {row.closedReason ? <span>{HELP_CLOSE_REASON_LABELS[row.closedReason]}</span> : null}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      label: "অবস্থা",
      width: "9.5rem",
      render: (row) => <HelpStatusCell row={row} />,
    },
    {
      key: "requester",
      label: "প্রশ্নকারী",
      width: "11rem",
      render: (row) =>
        row.requesterName || row.email ? (
          <span className="flex min-w-0 flex-col">
            {row.requesterName ? <span className="break-words">{row.requesterName}</span> : null}
            {row.email ? (
              <span className="text-xs break-all text-(--text-3)">{row.email}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-(--text-3)">নাম নেই</span>
        ),
    },
    {
      key: "created",
      label: "পাঠানো",
      width: "8.5rem",
      render: (row) => <WhenCell value={row.createdAt} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="আলেমের কাছে প্রশ্ন"
        description={
          viewer && !viewer.canHandle
            ? "পাঠকদের পাঠানো প্রশ্নগুলো দেখুন। উত্তর দেওয়া বা বন্ধ করার কাজ আলেম ও অ্যাডমিনগণ করেন।"
            : "পাঠকদের পাঠানো প্রশ্ন নিজের নামে নিন, দলিলসহ উত্তর লিখুন বা যথাযথ কারণে বন্ধ করুন। প্রশ্ন নিলে অন্যরা জানবেন আপনি দেখছেন।"
        }
      />

      <div ref={listTop} className="scroll-mt-16 lg:scroll-mt-4">
        <Card padded={false}>
          <div className="flex flex-col gap-3 border-b border-(--border) p-3 sm:p-4">
            <div
              role="tablist"
              aria-label="অবস্থা অনুযায়ী ছাঁকুন"
              className="thin-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
            >
              {filters.map((value) => {
                const count = value === "all" ? null : stats?.[value];
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    onClick={() => choose(value)}
                    className={clsx(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap transition",
                      filter === value
                        ? "bg-(--accent) text-(--accent-contrast)"
                        : "bg-(--surface-2) text-(--text-2) hover:text-(--text-1)",
                    )}
                  >
                    {HELP_FILTER_LABELS[value]}
                    {count !== null && count !== undefined ? (
                      <span className="text-xs tabular-nums opacity-80">{formatCount(count)}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <form onSubmit={submit} className="flex min-w-0 gap-2" role="search">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-3)" />
                <Input
                  aria-label="প্রশ্নে খুঁজুন"
                  placeholder="প্রশ্নের অংশ বা আইডি লিখে খুঁজুন"
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
          </div>

          <div className="p-3 sm:p-4" aria-busy={loading}>
            {!firstPage && error ? (
              <LoadError message={error} onRetry={list.retry} />
            ) : !firstPage ? (
              <Skeleton rows={5} />
            ) : items.length === 0 && !list.hasMore ? (
              <EmptyState title={query ? "কিছু পাওয়া যায়নি" : "এই তালিকায় কোনো প্রশ্ন নেই"}>
                {query
                  ? "অন্য শব্দে খুঁজে দেখুন বা ছাঁকনি বদলান।"
                  : filter === "open"
                    ? "আলহামদুলিল্লাহ, অপেক্ষমাণ কোনো প্রশ্ন নেই।"
                    : "অন্য ছাঁকনি বেছে দেখুন।"}
              </EmptyState>
            ) : (
              <>
                <p className="mb-3 text-xs text-(--text-3) tabular-nums">
                  {stats
                    ? `অপেক্ষমাণ ${formatCount(stats.open)} · দেখা হচ্ছে ${formatCount(stats.claimed)} · উত্তর দেওয়া ${formatCount(stats.answered)} · বন্ধ ${formatCount(stats.closed)}`
                    : null}
                  {` · এই তালিকায় ${formatCount(firstPage.total)}টি`}
                </p>
                <VirtualDataList
                  rows={items}
                  columns={columns}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => router.push(`/admin/help/${row.id}`)}
                  estimateRowHeight={78}
                  estimateCardHeight={200}
                  hasMore={list.hasMore}
                  loadingMore={list.loadingMore}
                  error={error}
                  onLoadMore={list.loadMore}
                  onRetry={list.retry}
                  endLabel="সব প্রশ্ন দেখানো হয়েছে"
                />
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
