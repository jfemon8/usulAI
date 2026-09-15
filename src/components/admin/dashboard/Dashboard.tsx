"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ADMIN_NAV } from "@/components/admin/AdminShell";
import { actionLabel, SOURCE_NAMES } from "@/components/admin/labels";
import {
  Button,
  Card,
  EmptyState,
  formatCount,
  formatSize,
  formatWhen,
  LoadError,
  PageHeader,
  Skeleton,
  Stat,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { RetryIcon } from "@/components/ui/Icons";
import type { DashboardSnapshot } from "@/lib/admin/dashboard";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, Math.round((part / whole) * 1000) / 10) : 0;
}

function Meter({ value, tone }: { value: number; tone?: "warn" | "danger" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-(--surface-3)">
      <div
        className={clsx(
          "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
          tone === "danger" ? "bg-(--danger)" : tone === "warn" ? "bg-(--warn)" : "bg-(--accent)",
        )}
        style={{ width: `${Math.max(value, value > 0 ? 1.5 : 0)}%` }}
      />
    </div>
  );
}

function Unavailable() {
  return <p className="text-sm text-(--text-3)">এই তথ্য এখন আনা যায়নি।</p>;
}

export function Dashboard({ email }: { email: string }) {
  const { data, error, loading, reload } = useAdminData<DashboardSnapshot>("/api/admin/dashboard");

  const shortcuts = ADMIN_NAV.flatMap((group) => group.items).filter(
    (item) => item.href !== "/admin",
  );

  return (
    <>
      <PageHeader
        title="ড্যাশবোর্ড"
        description={`আসসালামু আলাইকুম, ${email}। সাইট, AI কনটেন্ট ও রিসোর্সের সারসংক্ষেপ।`}
        actions={
          <Button
            size="sm"
            onClick={reload}
            loading={loading && data !== null}
            icon={<RetryIcon className="h-4 w-4" />}
          >
            হালনাগাদ
          </Button>
        }
      />

      {error ? (
        <div className="mb-5">
          <LoadError message={error} onRetry={reload} />
        </div>
      ) : null}

      {!data ? (
        loading ? (
          <Skeleton rows={6} />
        ) : null
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="দলিল"
              value={data.corpus ? formatCount(data.corpus.total) : "…"}
              hint={
                data.corpus
                  ? `এমবেডিং ${formatCount(percent(data.corpus.embedded, data.corpus.total))}%`
                  : undefined
              }
            />
            <Stat
              label="আজকের প্রশ্ন"
              value={data.activity ? formatCount(data.activity.questionsToday) : "…"}
              hint={
                data.activity ? `৭ দিনে ${formatCount(data.activity.questionsWeek)}` : undefined
              }
            />
            <Stat
              label="যাচাইকৃত উত্তর"
              value={data.activity ? formatCount(data.activity.verifiedAnswers) : "…"}
              hint={
                data.activity ? `আলেমের ${formatCount(data.activity.scholarAnswers)}` : undefined
              }
            />
            <Stat
              label="ডাটাবেস ব্যবহার"
              value={
                data.storage
                  ? `${formatCount(percent(data.storage.usedBytes, data.storage.quotaBytes))}%`
                  : "…"
              }
              hint={
                data.storage
                  ? `${formatSize(data.storage.usedBytes)} / ${formatSize(data.storage.quotaBytes)}`
                  : undefined
              }
              tone={
                data.storage
                  ? data.storage.ratio >= 0.9
                    ? "danger"
                    : data.storage.ratio >= 0.8
                      ? "warn"
                      : undefined
                  : undefined
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card
              title="দলিল ভান্ডার"
              description="উৎস অনুযায়ী দলিলের সংখ্যা"
              actions={
                <Link href="/admin/corpus" className="text-sm text-(--accent) hover:underline">
                  পরিচালনা
                </Link>
              }
            >
              {data.corpus ? (
                <ul className="flex flex-col gap-3.5">
                  {data.corpus.bySource.map((row) => (
                    <li key={row.source} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-(--text-1)">{SOURCE_NAMES[row.source]}</span>
                        <span className="text-(--text-2) tabular-nums">
                          {formatCount(row.count)}
                        </span>
                      </div>
                      <Meter value={percent(row.count, data.corpus?.total ?? 0)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Unavailable />
              )}
            </Card>

            <Card
              title="MongoDB স্টোরেজ"
              description="সবচেয়ে বেশি জায়গা নেওয়া collection"
              actions={
                <Link href="/admin/database" className="text-sm text-(--accent) hover:underline">
                  ডাটাবেস
                </Link>
              }
            >
              {data.storage ? (
                <div className="flex flex-col gap-4">
                  <Meter
                    value={percent(data.storage.usedBytes, data.storage.quotaBytes)}
                    tone={
                      data.storage.ratio >= 0.9
                        ? "danger"
                        : data.storage.ratio >= 0.8
                          ? "warn"
                          : undefined
                    }
                  />
                  <ul className="flex flex-col divide-y divide-(--border)">
                    {data.storage.collections.map((row) => (
                      <li
                        key={row.name}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <Link
                          href={`/admin/database/${encodeURIComponent(row.name)}`}
                          className="min-w-0 truncate font-mono text-(--text-1) hover:text-(--accent)"
                        >
                          {row.name}
                        </Link>
                        <span className="shrink-0 text-xs text-(--text-3) tabular-nums">
                          {formatCount(row.count)} · {formatSize(row.bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Unavailable />
              )}
            </Card>

            <Card title="ব্যবহার ও মতামত" description="গত ৭ দিনের প্রশ্ন আর সব সময়ের মতামত">
              {data.activity || data.feedback ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-(--text-3)">উত্তর মেলেনি (৭ দিন)</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-(--text-1) tabular-nums">
                      {data.activity ? formatCount(data.activity.unansweredWeek) : "…"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-(--text-3)">সহায়ক বলেছেন</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-(--text-1) tabular-nums">
                      {data.feedback ? formatCount(data.feedback.helpful) : "…"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-(--text-3)">সহায়ক নয়</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-(--text-1) tabular-nums">
                      {data.feedback ? formatCount(data.feedback.unhelpful) : "…"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-(--text-3)">সূত্র ভুল</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-(--text-1) tabular-nums">
                      {data.feedback ? formatCount(data.feedback.wrongCitation) : "…"}
                    </dd>
                  </div>
                  <div className="col-span-2 border-t border-(--border) pt-3 text-xs text-(--text-3)">
                    সর্বশেষ স্বয়ংক্রিয় রক্ষণাবেক্ষণ:{" "}
                    {formatWhen(data.activity?.maintenanceCheckedAt)}
                  </div>
                </dl>
              ) : (
                <Unavailable />
              )}
            </Card>

            <Card
              title="AI ও Cloudinary"
              actions={
                <Link href="/admin/files" className="text-sm text-(--accent) hover:underline">
                  ফাইল
                </Link>
              }
            >
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-(--text-3)">চালু মডেল</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-(--text-1) tabular-nums">
                    {data.models ? formatCount(data.models.attempts) : "নেই"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-(--text-3)">প্রোভাইডার</dt>
                  <dd className="mt-0.5 truncate text-(--text-1)">
                    {data.models?.tiers.join(", ") || "নেই"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-(--text-3)">Cloudinary ফাইল</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-(--text-1) tabular-nums">
                    {data.cloudinary?.resources != null
                      ? formatCount(data.cloudinary.resources)
                      : "…"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-(--text-3)">Cloudinary স্টোরেজ</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-(--text-1) tabular-nums">
                    {data.cloudinary?.storageBytes != null
                      ? formatSize(data.cloudinary.storageBytes)
                      : "…"}
                  </dd>
                </div>
                {data.cloudinary?.creditsLimit ? (
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs text-(--text-3)">
                      <span>ক্রেডিট ({data.cloudinary.plan ?? "প্ল্যান"})</span>
                      <span className="tabular-nums">
                        {formatCount(data.cloudinary.creditsUsed ?? 0)} /{" "}
                        {formatCount(data.cloudinary.creditsLimit)}
                      </span>
                    </div>
                    <Meter
                      value={percent(
                        data.cloudinary.creditsUsed ?? 0,
                        data.cloudinary.creditsLimit,
                      )}
                    />
                  </div>
                ) : null}
              </dl>
            </Card>
          </div>

          <Card
            title="সাম্প্রতিক অ্যাডমিন কার্যক্রম"
            actions={
              <Link href="/admin/audit" className="text-sm text-(--accent) hover:underline">
                সব দেখুন
              </Link>
            }
          >
            {data.audit.length > 0 ? (
              <ul className="flex flex-col divide-y divide-(--border)">
                {data.audit.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="text-sm text-(--text-1) sm:w-56 sm:shrink-0">
                      {actionLabel(entry.action)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-(--text-3)">
                      {entry.target ?? entry.email}
                    </span>
                    <span className="text-xs text-(--text-3) tabular-nums">
                      {formatWhen(entry.at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="এখনো কোনো কার্যক্রম নেই" />
            )}
          </Card>

          <section aria-label="দ্রুত যান">
            <h2 className="mb-3 text-base font-semibold text-(--text-1)">দ্রুত যান</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {shortcuts.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-20 flex-col justify-between gap-2 rounded-2xl border border-(--border) p-3.5 text-sm text-(--text-1) transition hover:border-(--border-strong) hover:bg-(--surface-2)"
                >
                  <item.icon className="h-5 w-5 text-(--accent)" />
                  <span className="leading-5">{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
