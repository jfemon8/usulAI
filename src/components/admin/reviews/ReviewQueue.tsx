"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClaimBadge, FlagBadges } from "@/components/admin/reviews/ReviewBits";
import type { ReviewPage, ReviewSummary } from "@/components/admin/reviews/types";
import {
  Card,
  EmptyState,
  LoadError,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList, type VirtualColumn } from "@/components/admin/VirtualList";
import type { PrincipalView } from "@/lib/admin/roles";

type StatusFilter = "all" | "unclaimed" | "claimed" | "mine";
type VerdictFilter = "" | "unhelpful" | "wrong-citation" | "implicit";
type SortOrder = "flagged" | "newest";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "সব খোলা" },
  { value: "unclaimed", label: "কেউ নেননি" },
  { value: "claimed", label: "কেউ দেখছেন" },
  { value: "mine", label: "আমি দেখছি" },
];

const VERDICT_OPTIONS: { value: VerdictFilter; label: string }[] = [
  { value: "", label: "সব অভিযোগ" },
  { value: "unhelpful", label: "সহায়ক নয়" },
  { value: "wrong-citation", label: "সূত্র ভুল" },
  { value: "implicit", label: "কথোপকথনে অভিযোগ" },
];

function listPath(
  status: StatusFilter,
  verdict: VerdictFilter,
  sort: SortOrder,
  cursor: string | null,
): string {
  const params = new URLSearchParams({ status, sort });
  if (verdict) params.set("verdict", verdict);
  if (cursor) params.set("cursor", cursor);
  return `/api/admin/reviews?${params.toString()}`;
}

export function ReviewQueue({ principal }: { principal: PrincipalView }) {
  const router = useRouter();
  const canHandle = principal.permissions.includes("reviews.handle");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [verdict, setVerdict] = useState<VerdictFilter>("");
  const [sort, setSort] = useState<SortOrder>("flagged");

  const list = useInfiniteAdminData<ReviewPage, ReviewSummary>({
    key: JSON.stringify([status, verdict, sort]),
    path: (cursor) => listPath(status, verdict, sort, cursor),
    items: (page) => page.items,
    next: (page) => page.nextCursor,
  });
  const { items, firstPage, error } = list;
  const stats = firstPage?.stats ?? null;
  const filtered = status !== "all" || verdict !== "";

  const columns: VirtualColumn<ReviewSummary>[] = [
    {
      key: "question",
      label: "প্রশ্ন ও AI এর উত্তর",
      primary: true,
      width: "minmax(0, 1fr)",
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/reviews/${row.id}`}
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
    {
      key: "flags",
      label: "অভিযোগ",
      width: "10rem",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold tabular-nums">{formatCount(row.count)} বার</span>
          <FlagBadges row={row} />
        </div>
      ),
    },
    {
      key: "claim",
      label: "দায়িত্ব",
      width: "9rem",
      render: (row) => <ClaimBadge claim={row.claim} />,
    },
    {
      key: "last",
      label: "সর্বশেষ অভিযোগ",
      width: "8.5rem",
      className: "text-xs text-(--text-2)",
      render: (row) => formatWhen(row.lastFlaggedAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="উত্তর রিভিউ"
        description="পাঠক যেসব উত্তরকে সহায়ক নয় বা সূত্র ভুল বলেছেন, অথবা কথোপকথনে অভিযোগ করেছেন, সেগুলো এখানে জমা হয়। একজন আলেম সমাধান করলে তালিকা থেকে সরে যায়।"
      />

      {!canHandle ? (
        <div className="mb-4">
          <Notice>আপনি এই তালিকা শুধু দেখতে পারবেন। সমাধান করবেন আলেমগণ।</Notice>
        </div>
      ) : null}

      <Card padded={false}>
        <div className="grid grid-cols-1 gap-2 border-b border-(--border) p-3 sm:grid-cols-3 sm:p-4">
          <Select
            aria-label="অবস্থা অনুযায়ী ছাঁকুন"
            value={status}
            onChange={(event) =>
              setStatus(
                STATUS_OPTIONS.find((option) => option.value === event.target.value)?.value ??
                  "all",
              )
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="অভিযোগের ধরন অনুযায়ী ছাঁকুন"
            value={verdict}
            onChange={(event) =>
              setVerdict(
                VERDICT_OPTIONS.find((option) => option.value === event.target.value)?.value ?? "",
              )
            }
          >
            {VERDICT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="সাজানোর ক্রম"
            value={sort}
            onChange={(event) => setSort(event.target.value === "newest" ? "newest" : "flagged")}
          >
            <option value="flagged">সবচেয়ে বেশি অভিযোগ আগে</option>
            <option value="newest">সাম্প্রতিক অভিযোগ আগে</option>
          </Select>
        </div>

        <div className="p-3 sm:p-4" aria-busy={list.loading}>
          {!firstPage && error ? (
            <LoadError message={error} onRetry={list.retry} />
          ) : !firstPage ? (
            <Skeleton rows={5} />
          ) : (
            <>
              {stats ? (
                <p className="mb-3 text-xs text-(--text-3) tabular-nums">
                  খোলা {formatCount(stats.open)}টি · কেউ দেখছেন {formatCount(stats.claimed)}টি · আমি
                  দেখছি {formatCount(stats.mine)}টি · সূত্র ভুল {formatCount(stats.wrongCitation)}টি
                </p>
              ) : null}
              {items.length === 0 && !list.hasMore ? (
                <EmptyState title={filtered ? "এই ছাঁকনিতে কিছু নেই" : "রিভিউয়ের জন্য কিছু নেই"}>
                  {filtered
                    ? "ছাঁকনি বদলে দেখুন।"
                    : "পাঠক কোনো উত্তরে অভিযোগ করলে এখানে দেখা যাবে।"}
                </EmptyState>
              ) : (
                <VirtualDataList
                  rows={items}
                  columns={columns}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => router.push(`/admin/reviews/${row.id}`)}
                  estimateRowHeight={92}
                  estimateCardHeight={210}
                  hasMore={list.hasMore}
                  loadingMore={list.loadingMore}
                  error={error}
                  onLoadMore={list.loadMore}
                  onRetry={list.retry}
                  endLabel="সব রিভিউ দেখানো হয়েছে"
                />
              )}
            </>
          )}
        </div>
      </Card>
    </>
  );
}
