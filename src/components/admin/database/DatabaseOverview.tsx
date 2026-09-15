"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Badge,
  Button,
  Card,
  DataList,
  EmptyState,
  LoadError,
  PageHeader,
  Skeleton,
  Stat,
  formatCount,
  formatSize,
  type Column,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { RetryIcon } from "@/components/ui/Icons";
import { STORAGE_BUDGET } from "@/config/site";

export interface CollectionRow {
  name: string;
  description: string | null;
  count: number;
  dataBytes: number;
  indexBytes: number;
}

interface Overview {
  usage: {
    usedBytes: number;
    quotaBytes: number;
    dataBytes: number;
    indexBytes: number;
    ratio: number;
  };
  collections: CollectionRow[];
}

export function collectionHref(name: string): string {
  return `/admin/database/${encodeURIComponent(name)}`;
}

const percent = new Intl.NumberFormat("bn-BD", { style: "percent", maximumFractionDigits: 1 });

export function DatabaseOverview() {
  const router = useRouter();
  const { data, error, loading, reload } = useAdminData<Overview>("/api/admin/database");

  const ratio = data?.usage.ratio ?? 0;
  const tone =
    ratio >= STORAGE_BUDGET.evictAtRatio
      ? "danger"
      : ratio >= STORAGE_BUDGET.warnRatio
        ? "warn"
        : undefined;

  const columns: Column<CollectionRow>[] = [
    {
      key: "name",
      label: "কালেকশন",
      primary: true,
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={collectionHref(row.name)}
            onClick={(event) => event.stopPropagation()}
            className="font-mono text-sm font-medium break-all text-(--text-1) hover:text-(--accent)"
          >
            {row.name}
          </Link>
          {row.description ? (
            <p className="mt-0.5 text-xs leading-5 font-normal text-(--text-3)">
              {row.description}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-(--text-3)">
              <Badge>অপরিচিত</Badge>
            </p>
          )}
        </div>
      ),
    },
    {
      key: "count",
      label: "নথি",
      className: "whitespace-nowrap tabular-nums md:text-end",
      render: (row) => formatCount(row.count),
    },
    {
      key: "data",
      label: "ডেটা",
      className: "whitespace-nowrap tabular-nums md:text-end",
      render: (row) => formatSize(row.dataBytes),
    },
    {
      key: "index",
      label: "ইনডেক্স",
      className: "whitespace-nowrap tabular-nums md:text-end",
      render: (row) => formatSize(row.indexBytes),
    },
    {
      key: "share",
      label: "কোটার অংশ",
      className: "whitespace-nowrap tabular-nums md:text-end",
      render: (row) =>
        data ? percent.format((row.dataBytes + row.indexBytes) / data.usage.quotaBytes) : null,
    },
  ];

  return (
    <div className="min-w-0">
      <PageHeader
        title="ডাটাবেস"
        description="অ্যাপের প্রতিটি MongoDB কালেকশন দেখুন, খুঁজুন ও সম্পাদনা করুন। অ্যাডমিন অ্যাকাউন্ট, সেশন ও রিসেট টোকেন এখানে দেখানো হয় না।"
        actions={
          <Button
            onClick={reload}
            loading={loading && data !== null}
            icon={<RetryIcon className="h-4 w-4" />}
          >
            রিফ্রেশ
          </Button>
        }
      />

      {error ? (
        <div className="mb-4">
          <LoadError message={error} onRetry={reload} />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="মোট ব্যবহার"
              value={formatSize(data.usage.usedBytes)}
              hint={`${formatSize(data.usage.quotaBytes)} এর ${percent.format(ratio)}`}
              tone={tone}
            />
            <Stat label="ডেটা" value={formatSize(data.usage.dataBytes)} />
            <Stat label="ইনডেক্স" value={formatSize(data.usage.indexBytes)} />
            <Stat label="কালেকশন" value={formatCount(data.collections.length)} />
          </div>
          <div
            className="mb-5 h-2 overflow-hidden rounded-full bg-(--surface-3)"
            role="progressbar"
            aria-label="Atlas স্টোরেজ ব্যবহার"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
          >
            <div
              className={clsx(
                "h-full rounded-full transition-[width]",
                tone === "danger"
                  ? "bg-(--danger)"
                  : tone === "warn"
                    ? "bg-(--warn)"
                    : "bg-(--accent)",
              )}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
          <Card
            title="কালেকশন"
            description="ডেটা ও ইনডেক্সের আকার Atlas M0 কোটায় পুরোপুরি গোনা হয়।"
            padded={false}
          >
            <div className="p-2 sm:p-3">
              {data.collections.length === 0 ? (
                <EmptyState title="কোনো কালেকশন পাওয়া যায়নি" />
              ) : (
                <DataList
                  rows={data.collections}
                  columns={columns}
                  rowKey={(row) => row.name}
                  onRowClick={(row) => router.push(collectionHref(row.name))}
                />
              )}
            </div>
          </Card>
        </>
      ) : loading ? (
        <Skeleton rows={6} />
      ) : null}
    </div>
  );
}
