"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "@/components/admin/api";
import { BulkDeleteDialog } from "@/components/admin/database/BulkDeleteDialog";
import { CreateDocumentDialog } from "@/components/admin/database/CreateDocumentDialog";
import { DocumentDialog } from "@/components/admin/database/DocumentDialog";
import { locateJsonError } from "@/components/admin/database/jsonText";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadError,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  formatCount,
  formatSize,
} from "@/components/admin/ui";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList, type VirtualColumn } from "@/components/admin/VirtualList";
import { ChevronLeftIcon, PlusIcon, RetryIcon, SearchIcon, TrashIcon } from "@/components/ui/Icons";
import { DB_CONFIG } from "@/config/site";

interface Row {
  id: string;
  fields: { key: string; value: string }[];
  bytes: number;
  binaries: number;
}

interface ListPayload {
  collection: string;
  description: string | null;
  page: number;
  offset: number;
  pageSize: number;
  hasNext: boolean;
  counted: boolean;
  total: number | null;
  totalCapped: boolean;
  emptyFilter: boolean;
  rows: Row[];
}

export interface BrowserQuery {
  filter: string;
  sort: string;
  dir: "asc" | "desc";
}

const DEDICATED_EDITORS: Record<
  string,
  { message: string; links: { href: string; label: string }[] }
> = {
  [DB_CONFIG.collection]: {
    message:
      "এখানে দলিলের content বদলালে contentHash নতুন করে হিসাব হয় না এবং পুরোনো embedding থেকে যায়, ফলে সার্চ ভুল ফল দিতে পারে। দলিল সম্পাদনার জন্য দলিল ভান্ডার ব্যবহার করুন।",
    links: [{ href: "/admin/corpus", label: "দলিল ভান্ডার" }],
  },
  [DB_CONFIG.quranNotesCollection]: {
    message:
      "কুরআনের নোট প্রতি সূরায় একটি সংকুচিত Binary হিসেবে থাকে, এখানে পড়া বা বদলানো কার্যত সম্ভব নয়। কুরআনের নোট পাতায় সম্পাদনা করুন।",
    links: [{ href: "/admin/notes", label: "কুরআনের নোট" }],
  },
  [DB_CONFIG.verifiedAnswerCollection]: {
    message:
      "যাচাইকৃত উত্তর মডেল ছাড়াই সরাসরি পাঠকদের দেখানো হয়। বিষয়, সূত্র ও উৎস ঠিক রাখতে যাচাইকৃত উত্তর পাতা ব্যবহার করুন।",
    links: [{ href: "/admin/answers", label: "যাচাইকৃত উত্তর" }],
  },
  [DB_CONFIG.siteContentCollection]: {
    message: "সাইট কনটেন্ট ও AI সেটিংসের নিজস্ব সম্পাদক আছে, সেখানে মান যাচাই করে সংরক্ষণ করা হয়।",
    links: [
      { href: "/admin/site", label: "সাইট কনটেন্ট" },
      { href: "/admin/ai", label: "AI সেটিংস" },
    ],
  },
};

const GUARDED: readonly string[] = [
  DB_CONFIG.collection,
  DB_CONFIG.quranNotesCollection,
  DB_CONFIG.verifiedAnswerCollection,
];

function querySearch(query: BrowserQuery): string {
  const params = new URLSearchParams();
  if (query.filter.trim()) params.set("filter", query.filter.trim());
  if (query.sort.trim() && query.sort.trim() !== "_id") params.set("sort", query.sort.trim());
  if (query.dir === "asc") params.set("dir", "asc");
  return params.toString();
}

function collectionPath(collection: string): string {
  return `/api/admin/database/${encodeURIComponent(collection)}`;
}

function listPath(collection: string, query: BrowserQuery, offset: number): string {
  const params = new URLSearchParams(querySearch(query));
  if (offset > 0) params.set("offset", String(offset));
  const search = params.toString();
  return `${collectionPath(collection)}${search ? `?${search}` : ""}`;
}

function rowPath(collection: string, id: string): string {
  return `${collectionPath(collection)}?row=${encodeURIComponent(id)}`;
}

function uniqueRows(rows: Row[]): Row[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function syncUrl(query: BrowserQuery) {
  const search = querySearch(query);
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${search ? `?${search}` : ""}`,
  );
}

export function CollectionBrowser({
  collection,
  initial,
}: {
  collection: string;
  initial: BrowserQuery;
}) {
  const [query, setQuery] = useState<BrowserQuery>(initial);
  const [draftFilter, setDraftFilter] = useState(initial.filter);
  const [draftSort, setDraftSort] = useState(initial.sort);
  const [draftDir, setDraftDir] = useState<BrowserQuery["dir"]>(initial.dir);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const loadedRef = useRef(0);
  const {
    items,
    pages,
    firstPage,
    error,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    retry,
    reload,
    setPages,
  } = useInfiniteAdminData<ListPayload, Row>({
    key: `${collection}?${querySearch(query)}`,
    path: (cursor) => listPath(collection, query, cursor === null ? 0 : loadedRef.current),
    items: (page) => page.rows,
    next: (page) => (page.hasNext ? String(page.offset + page.rows.length) : null),
  });

  useEffect(() => {
    loadedRef.current = pages.reduce((total, page) => total + page.rows.length, 0);
  });

  const rows = uniqueRows(items);

  const applyQuery = (next: BrowserQuery) => {
    setQuery(next);
    syncUrl(next);
  };

  const applyFilters = () => {
    const problem = locateJsonError(draftFilter, { allowEmpty: true });
    if (problem) {
      setFilterError(problem.message);
      return;
    }
    if (draftSort.trim() && !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,199}$/.test(draftSort.trim())) {
      setFilterError("সাজানোর ফিল্ডের নাম সঠিক নয়।");
      return;
    }
    setFilterError(null);
    applyQuery({ filter: draftFilter.trim(), sort: draftSort.trim(), dir: draftDir });
  };

  const clearFilters = () => {
    setDraftFilter("");
    setDraftSort("");
    setDraftDir("desc");
    setFilterError(null);
    applyQuery({ filter: "", sort: "", dir: "desc" });
  };

  const closeDocument = useCallback(() => setOpenId(null), []);
  const closeCreate = useCallback(() => setCreating(false), []);
  const closeBulk = useCallback(() => setBulkOpen(false), []);
  const created = useCallback(
    (id: string) => {
      setCreating(false);
      setOpenId(id);
      reload();
    },
    [reload],
  );
  const bulkDeleted = useCallback(() => {
    setBulkOpen(false);
    reload();
  }, [reload]);

  const documentChanged = useCallback(
    (id: string) => {
      adminApi<{ row: Row | null }>(rowPath(collection, id)).then(
        ({ row }) => {
          setPages((current) => {
            const present = current.some((page) => page.rows.some((item) => item.id === id));
            if (!present) return current;
            return current.map((page, index) => ({
              ...page,
              rows: row
                ? page.rows.map((item) => (item.id === id ? row : item))
                : page.rows.filter((item) => item.id !== id),
              total:
                !row && index === 0 && page.total !== null && !page.totalCapped
                  ? Math.max(0, page.total - 1)
                  : page.total,
            }));
          });
        },
        () => reload(),
      );
    },
    [collection, reload, setPages],
  );

  const dedicated = DEDICATED_EDITORS[collection];

  const columns: VirtualColumn<Row>[] = [
    {
      key: "id",
      label: "_id",
      primary: true,
      width: "14rem",
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs break-all text-(--text-1)">
          {row.id}
        </span>
      ),
    },
    {
      key: "fields",
      label: "ফিল্ড",
      render: (row) =>
        row.fields.length === 0 ? (
          <span className="text-(--text-3)">সাধারণ ফিল্ড নেই</span>
        ) : (
          <ul className="flex min-w-0 flex-col gap-0.5">
            {row.fields.map((field) => (
              <li key={field.key} className="min-w-0 text-xs leading-5 break-words">
                <span dir="ltr" className="font-mono text-(--text-3)">
                  {field.key}:
                </span>{" "}
                <span className="text-(--text-1)">{field.value}</span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: "size",
      label: "আকার",
      width: "8rem",
      className: "whitespace-nowrap tabular-nums md:text-end",
      render: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1 md:justify-end">
          {formatSize(row.bytes)}
          {row.binaries > 0 ? (
            <Badge tone="accent">Binary {formatCount(row.binaries)}</Badge>
          ) : null}
        </span>
      ),
    },
  ];

  const totalLabel =
    firstPage?.total === null || firstPage?.total === undefined
      ? "গণনা করা যায়নি"
      : `${formatCount(firstPage.total)}${firstPage.totalCapped ? "+" : ""}টি নথি`;

  return (
    <div className="min-w-0">
      <div className="mb-3">
        <Link
          href="/admin/database"
          className="inline-flex h-10 items-center gap-1 rounded-xl pe-3 text-sm text-(--text-2) hover:text-(--text-1)"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          সব কালেকশন
        </Link>
      </div>

      <PageHeader
        title={collection}
        description={
          firstPage?.description ?? "MongoDB কালেকশনের নথি দেখুন, খুঁজুন ও সম্পাদনা করুন।"
        }
        actions={
          <>
            <Button onClick={reload} loading={loading} icon={<RetryIcon className="h-4 w-4" />}>
              রিফ্রেশ
            </Button>
            <Button
              tone="danger"
              onClick={() => setBulkOpen(true)}
              disabled={rows.length === 0}
              icon={<TrashIcon className="h-4 w-4" />}
            >
              ফিল্টার অনুযায়ী মুছুন
            </Button>
            <Button
              tone="primary"
              onClick={() => setCreating(true)}
              icon={<PlusIcon className="h-4 w-4" />}
            >
              নতুন নথি
            </Button>
          </>
        }
      />

      {dedicated ? (
        <div className="mb-4">
          <Notice
            tone="warn"
            action={
              <div className="flex flex-wrap gap-2">
                {dedicated.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex h-9 items-center rounded-xl border border-(--border) bg-(--bg) px-3 text-sm font-medium text-(--text-1) hover:bg-(--surface-2)"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            }
          >
            {dedicated.message}
          </Notice>
        </div>
      ) : null}

      <Card className="mb-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <Field
            label="ফিল্টার (Extended JSON)"
            error={filterError}
            hint='যেমন {"sourceType": "quran"} বা {"_id": {"$oid": "..."}}। খালি রাখলে সব নথি।'
          >
            {(id) => (
              <Textarea
                id={id}
                dir="ltr"
                rows={2}
                value={draftFilter}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="{}"
                onChange={(event) => setDraftFilter(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    applyFilters();
                  }
                }}
                className="min-h-16 font-mono text-sm"
              />
            )}
          </Field>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="সাজানোর ফিল্ড" className="min-w-0 sm:flex-1">
              {(id) => (
                <Input
                  id={id}
                  dir="ltr"
                  value={draftSort}
                  placeholder="_id"
                  spellCheck={false}
                  autoCapitalize="off"
                  onChange={(event) => setDraftSort(event.target.value)}
                  className="font-mono"
                />
              )}
            </Field>
            <Field label="ক্রম" className="sm:w-44">
              {(id) => (
                <Select
                  id={id}
                  value={draftDir}
                  onChange={(event) => setDraftDir(event.target.value === "asc" ? "asc" : "desc")}
                >
                  <option value="desc">নতুন থেকে পুরোনো</option>
                  <option value="asc">পুরোনো থেকে নতুন</option>
                </Select>
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" tone="primary" icon={<SearchIcon className="h-4 w-4" />}>
                খুঁজুন
              </Button>
              <Button onClick={clearFilters}>মুছে দিন</Button>
            </div>
          </div>
        </form>
      </Card>

      {error && !firstPage ? (
        <div className="mb-4">
          <LoadError message={error} onRetry={retry} />
        </div>
      ) : null}

      <Card
        title={firstPage ? totalLabel : "নথি"}
        description={
          query.filter
            ? "ফিল্টার প্রয়োগ করা আছে।"
            : "নথিতে ট্যাপ করলে পুরো Extended JSON দেখা ও সম্পাদনা করা যাবে।"
        }
        padded={false}
      >
        <div className="p-2 sm:p-3">
          {firstPage ? (
            rows.length === 0 && !hasMore ? (
              <EmptyState title="কোনো নথি পাওয়া যায়নি">
                {query.filter ? "ফিল্টার বদলে আবার খুঁজে দেখুন।" : "এই কালেকশন খালি।"}
              </EmptyState>
            ) : (
              <VirtualDataList
                rows={rows}
                columns={columns}
                rowKey={(row) => row.id}
                onRowClick={(row) => setOpenId(row.id)}
                estimateRowHeight={112}
                estimateCardHeight={190}
                hasMore={hasMore}
                loadingMore={loadingMore}
                error={error}
                onLoadMore={loadMore}
                onRetry={retry}
                endLabel={
                  pages.length > 1 ? `সব ${formatCount(rows.length)}টি নথি দেখানো হয়েছে` : null
                }
              />
            )
          ) : loading ? (
            <Skeleton rows={6} />
          ) : null}
        </div>
      </Card>

      {openId ? (
        <DocumentDialog
          key={openId}
          collection={collection}
          documentId={openId}
          onClose={closeDocument}
          onChanged={() => documentChanged(openId)}
        />
      ) : null}
      {creating ? (
        <CreateDocumentDialog collection={collection} onClose={closeCreate} onCreated={created} />
      ) : null}
      {bulkOpen ? (
        <BulkDeleteDialog
          collection={collection}
          filter={query.filter}
          total={firstPage?.total ?? null}
          totalCapped={firstPage?.totalCapped ?? false}
          guarded={GUARDED.includes(collection)}
          onClose={closeBulk}
          onDeleted={bulkDeleted}
        />
      ) : null}
    </div>
  );
}
