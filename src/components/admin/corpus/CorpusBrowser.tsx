"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { clsx } from "clsx";
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  LoadError,
  Notice,
  PageHeader,
  Skeleton,
  Spinner,
  formatCount,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList, type VirtualColumn } from "@/components/admin/VirtualList";
import { DocumentFlags, SourceBadge } from "@/components/admin/corpus/CorpusBadges";
import {
  CORPUS_SOURCE_LABELS,
  type CorpusListResponse,
  type CorpusRow,
  type CorpusStatsResponse,
} from "@/components/admin/corpus/types";
import { CloseIcon, PlusIcon, SearchIcon } from "@/components/ui/Icons";
import { SOURCE_PRIORITY } from "@/config/site";
import type { SourceType } from "@/types";

const percent = new Intl.NumberFormat("bn-BD", { style: "percent", maximumFractionDigits: 1 });

function coverage(embedded: number, total: number): string {
  return percent.format(total > 0 ? embedded / total : 0);
}

function listPath(source: SourceType | "", query: string, cursor: string | null): string {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (query) params.set("q", query);
  if (cursor) params.set("cursor", cursor);
  const search = params.toString();
  return `/api/admin/corpus${search ? `?${search}` : ""}`;
}

function syncAddress(source: SourceType | "", query: string) {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (query) params.set("q", query);
  const search = params.toString();
  window.history.replaceState(null, "", `/admin/corpus${search ? `?${search}` : ""}`);
}

function revealListTop(element: HTMLElement | null) {
  if (!element) return;
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  if (element.getBoundingClientRect().top >= margin) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

const MODE_NOTES: Record<CorpusListResponse["mode"], string | null> = {
  list: null,
  id: "আইডি দিয়ে খোঁজা হয়েছে।",
  reference: "রেফারেন্স হুবহু মিলেছে।",
  search: "লেখার ভেতরে খোঁজার ফল, প্রাসঙ্গিকতা অনুযায়ী সাজানো।",
};

function SourceTiles({
  stats,
  statsLoading,
  active,
  onSelect,
}: {
  stats: CorpusStatsResponse | null;
  statsLoading: boolean;
  active: SourceType | "";
  onSelect: (source: SourceType | "") => void;
}) {
  const tiles: { key: SourceType | ""; label: string; total?: number; embedded?: number }[] = [
    { key: "", label: "সব উৎস", total: stats?.total, embedded: stats?.embedded },
    ...SOURCE_PRIORITY.map((sourceType) => {
      const entry = stats?.sources.find((item) => item.sourceType === sourceType);
      return {
        key: sourceType,
        label: CORPUS_SOURCE_LABELS[sourceType],
        total: entry?.total,
        embedded: entry?.embedded,
      };
    }),
  ];

  return (
    <div
      className="thin-scroll -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7"
      role="group"
      aria-label="উৎস অনুযায়ী ছাঁকুন"
    >
      {tiles.map((tile) => {
        const selected = active === tile.key;
        const ratio =
          tile.total && tile.embedded !== undefined ? Math.min(1, tile.embedded / tile.total) : 0;
        return (
          <button
            key={tile.key || "all"}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(tile.key)}
            className={clsx(
              "flex min-w-38 shrink-0 snap-start flex-col gap-1 rounded-2xl border px-3.5 py-3 text-start transition sm:min-w-0",
              selected
                ? "border-(--accent) bg-(--accent-soft)"
                : "border-(--border) bg-(--bg) hover:bg-(--surface-2)",
            )}
          >
            <span
              className={clsx(
                "truncate text-xs font-medium",
                selected ? "text-(--accent)" : "text-(--text-2)",
              )}
            >
              {tile.label}
            </span>
            <span className="text-lg font-semibold text-(--text-1) tabular-nums">
              {tile.total !== undefined ? (
                formatCount(tile.total)
              ) : statsLoading ? (
                <span className="inline-block h-5 w-14 animate-pulse rounded bg-(--surface-2) align-middle motion-reduce:animate-none" />
              ) : (
                "নেই"
              )}
            </span>
            <span className="h-1 w-full overflow-hidden rounded-full bg-(--surface-3)">
              <span
                className="block h-full rounded-full bg-(--accent)"
                style={{ width: `${ratio * 100}%` }}
              />
            </span>
            <span className="truncate text-[0.6875rem] text-(--text-3) tabular-nums">
              {tile.total !== undefined && tile.embedded !== undefined
                ? `এমবেডিং ${coverage(tile.embedded, tile.total)}`
                : "এমবেডিং"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CorpusBrowser({
  initialSource,
  initialQuery,
}: {
  initialSource: SourceType | "";
  initialQuery: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState<SourceType | "">(initialSource);
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const listTop = useRef<HTMLDivElement>(null);

  const list = useInfiniteAdminData<CorpusListResponse, CorpusRow>({
    key: JSON.stringify([source, query]),
    path: (cursor) => listPath(source, query, cursor),
    items: (page) => page.items,
    next: (page) => (page.mode === "list" ? page.nextCursor : null),
  });
  const { items, firstPage, error, loading } = list;
  const stats = useAdminData<CorpusStatsResponse>("/api/admin/corpus?stats=1");

  const openedById = firstPage?.mode === "id" ? firstPage.items[0] : undefined;

  useEffect(() => {
    if (!openedById) return;
    syncAddress(source, "");
    router.push(`/admin/corpus/${openedById.id}`);
  }, [openedById, router, source]);

  function selectSource(next: SourceType | "") {
    setSource(next);
    syncAddress(next, query);
    revealListTop(listTop.current);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draft.trim();
    setQuery(next);
    syncAddress(source, next);
    revealListTop(listTop.current);
  }

  function clearSearch() {
    setDraft("");
    setQuery("");
    syncAddress(source, "");
    revealListTop(listTop.current);
  }

  const columns: VirtualColumn<CorpusRow>[] = [
    {
      key: "reference",
      label: "রেফারেন্স ও লেখা",
      primary: true,
      width: "minmax(0, 1fr)",
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/corpus/${row.id}`}
            onClick={(event) => event.stopPropagation()}
            dir="auto"
            className="font-medium break-words text-(--text-1) hover:text-(--accent) hover:underline"
          >
            {row.reference}
          </Link>
          <p
            dir="auto"
            className="mt-1 line-clamp-2 text-xs leading-5 font-normal break-words text-(--text-3)"
          >
            {row.preview || "লেখা নেই"}
          </p>
        </div>
      ),
    },
    {
      key: "source",
      label: "উৎস",
      width: "8.5rem",
      render: (row) => <SourceBadge sourceType={row.sourceType} />,
    },
    {
      key: "state",
      label: "অবস্থা",
      width: "10rem",
      render: (row) => (
        <DocumentFlags
          embedded={row.embedded}
          adminEdited={row.adminEdited}
          restricted={row.restricted}
        />
      ),
    },
  ];

  const note = firstPage ? MODE_NOTES[firstPage.mode] : null;
  const limited = Boolean(firstPage?.limited);
  const sourceTotal = source
    ? stats.data?.sources.find((entry) => entry.sourceType === source)?.total
    : stats.data?.total;
  const countLine =
    firstPage?.mode === "list"
      ? sourceTotal !== undefined
        ? `মোট ${formatCount(sourceTotal)}টি দলিল · ${formatCount(items.length)}টি দেখানো হচ্ছে`
        : `${formatCount(items.length)}টি দেখানো হচ্ছে`
      : `${formatCount(items.length)}টি ফল`;

  return (
    <>
      <PageHeader
        title="দলিল ভান্ডার"
        description="কুরআন, হাদিস, ইজমা, কিয়াস, সীরাত ও ফিকহের প্রতিটি দলিল দেখুন, খুঁজুন, সম্পাদনা করুন। অ্যাডমিন সম্পাদিত দলিল ingestion আর বদলায় না।"
        actions={
          <Link
            href={source ? `/admin/corpus/new?source=${source}` : "/admin/corpus/new"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast) transition hover:bg-(--accent-strong)"
          >
            <PlusIcon className="h-4 w-4" />
            নতুন দলিল
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        {stats.error ? <LoadError message={stats.error} onRetry={stats.reload} /> : null}
        <SourceTiles
          stats={stats.data}
          statsLoading={stats.loading}
          active={source}
          onSelect={selectSource}
        />

        <div ref={listTop} className="scroll-mt-16 lg:scroll-mt-4">
          <Card padded={false}>
            <div className="border-b border-(--border) p-3 sm:p-4">
              <form onSubmit={submit} className="flex gap-2" role="search">
                <div className="relative min-w-0 flex-1">
                  <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-3)" />
                  <Input
                    type="search"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="আইডি, পুরো রেফারেন্স বা লেখার শব্দ"
                    aria-label="দলিল খুঁজুন"
                    dir="auto"
                    enterKeyHint="search"
                    maxLength={200}
                    className="ps-9 pe-10"
                  />
                  {draft ? (
                    <IconButton
                      label="খোঁজা মুছুন"
                      onClick={clearSearch}
                      className="absolute end-0.5 top-1/2 h-9 w-9 -translate-y-1/2"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </IconButton>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  tone="primary"
                  aria-label="খুঁজুন"
                  icon={<SearchIcon className="h-4 w-4" />}
                >
                  <span className="hidden sm:inline">খুঁজুন</span>
                </Button>
              </form>
              {query ? (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--text-3)">
                  <span dir="auto">&ldquo;{query}&rdquo;</span>
                  {source ? <span>· {CORPUS_SOURCE_LABELS[source]}</span> : <span>· সব উৎস</span>}
                  {note ? <span>· {note}</span> : null}
                  {limited ? <span>· প্রথম ৫০টি ফল দেখানো হচ্ছে</span> : null}
                </p>
              ) : null}
            </div>

            <div className="p-3 sm:p-4" aria-busy={loading}>
              {!firstPage && error ? (
                <LoadError message={error} onRetry={list.retry} />
              ) : !firstPage ? (
                <Skeleton rows={6} />
              ) : items.length === 0 && !list.hasMore ? (
                <EmptyState title={query ? "কিছু পাওয়া যায়নি" : "এই উৎসে কোনো দলিল নেই"}>
                  {query
                    ? "অন্য শব্দ, পুরো রেফারেন্স (যেমন সহীহ বুখারী 1454) বা দলিলের আইডি দিয়ে চেষ্টা করুন।"
                    : null}
                </EmptyState>
              ) : (
                <>
                  {openedById ? (
                    <Notice>
                      <span className="inline-flex items-center gap-2">
                        <Spinner /> দলিলটি খোলা হচ্ছে
                      </span>
                    </Notice>
                  ) : null}
                  <p className="mb-3 text-xs text-(--text-3) tabular-nums">{countLine}</p>
                  <VirtualDataList
                    rows={items}
                    columns={columns}
                    rowKey={(row) => row.id}
                    onRowClick={(row) => router.push(`/admin/corpus/${row.id}`)}
                    estimateRowHeight={90}
                    estimateCardHeight={150}
                    hasMore={list.hasMore}
                    loadingMore={list.loadingMore}
                    error={error}
                    onLoadMore={list.loadMore}
                    onRetry={list.retry}
                    endLabel={
                      firstPage.mode !== "list"
                        ? limited
                          ? "প্রথম ৫০টি ফলের বেশি দেখানো হয় না। আরও নির্দিষ্ট শব্দে খুঁজুন।"
                          : "সব ফল দেখানো হয়েছে"
                        : "সব দলিল দেখানো হয়েছে"
                    }
                  />
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
