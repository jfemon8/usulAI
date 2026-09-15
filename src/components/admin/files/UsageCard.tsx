"use client";

import { clsx } from "clsx";
import { Card, formatCount, formatSize, formatWhen, IconButton, Stat } from "@/components/admin/ui";
import type { UsageSummary } from "@/components/admin/files/shared";
import { RetryIcon } from "@/components/ui/Icons";

const percentFormat = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 1 });
const creditFormat = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 2 });

function toneFor(percent: number | null): "warn" | "danger" | undefined {
  if (percent === null) return undefined;
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warn";
  return undefined;
}

function limitHint(
  metric: { limit: number | null; usedPercent: number | null; creditsUsage: number | null } | null,
  format: (value: number) => string,
): string | undefined {
  if (!metric) return undefined;
  if (metric.limit !== null) {
    const percent =
      metric.usedPercent !== null ? ` (${percentFormat.format(metric.usedPercent)}%)` : "";
    return `সীমা ${format(metric.limit)}${percent}`;
  }
  if (metric.creditsUsage !== null) return `${creditFormat.format(metric.creditsUsage)} ক্রেডিট`;
  return undefined;
}

export function UsageCard({
  usage,
  loading,
  error,
  onReload,
}: {
  usage: UsageSummary | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  const credits = usage?.credits ?? null;
  const creditPercent =
    credits?.usedPercent ??
    (credits && credits.limit ? (credits.usage / credits.limit) * 100 : null);

  return (
    <Card
      title="Cloudinary ব্যবহার"
      description={
        usage
          ? `প্ল্যান: ${usage.plan ?? "অজানা"}${usage.lastUpdated ? `, হালনাগাদ ${formatWhen(usage.lastUpdated)}` : ""}`
          : "অ্যাকাউন্টের স্টোরেজ, ব্যান্ডউইথ ও ক্রেডিটের হিসাব"
      }
      actions={
        <IconButton label="ব্যবহারের হিসাব আবার আনুন" onClick={onReload} disabled={loading}>
          <RetryIcon
            className={clsx("h-4 w-4", loading && "animate-spin motion-reduce:animate-none")}
          />
        </IconButton>
      }
    >
      {error ? (
        <p className="text-sm text-(--danger)">{error}</p>
      ) : !usage ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-[5.25rem] animate-pulse rounded-2xl bg-(--surface-2) motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat
              label="স্টোরেজ"
              value={usage.storage ? formatSize(usage.storage.usage) : "নেই"}
              hint={limitHint(usage.storage, formatSize)}
              tone={toneFor(usage.storage?.usedPercent ?? null)}
            />
            <Stat
              label="ব্যান্ডউইথ"
              value={usage.bandwidth ? formatSize(usage.bandwidth.usage) : "নেই"}
              hint={limitHint(usage.bandwidth, formatSize)}
              tone={toneFor(usage.bandwidth?.usedPercent ?? null)}
            />
            <Stat
              label="ট্রান্সফরমেশন"
              value={usage.transformations ? formatCount(usage.transformations.usage) : "নেই"}
              hint={limitHint(usage.transformations, formatCount)}
              tone={toneFor(usage.transformations?.usedPercent ?? null)}
            />
            <Stat
              label="ক্রেডিট"
              value={
                credits
                  ? `${creditFormat.format(credits.usage)}${credits.limit !== null ? ` / ${creditFormat.format(credits.limit)}` : ""}`
                  : "নেই"
              }
              hint={
                creditPercent !== null
                  ? `${percentFormat.format(creditPercent)}% ব্যবহৃত`
                  : undefined
              }
              tone={toneFor(creditPercent)}
            />
            <Stat
              label="ফাইল"
              value={usage.resources !== null ? formatCount(usage.resources) : "নেই"}
              hint={
                usage.derivedResources
                  ? `ডেরাইভড ${formatCount(usage.derivedResources)}`
                  : "মোট সংরক্ষিত ফাইল"
              }
            />
          </div>
          {creditPercent !== null ? (
            <div
              role="progressbar"
              aria-label="ক্রেডিট ব্যবহার"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(100, creditPercent))}
              className="h-1.5 overflow-hidden rounded-full bg-(--surface-3)"
            >
              <div
                className={clsx(
                  "h-full rounded-full",
                  creditPercent >= 90
                    ? "bg-(--danger)"
                    : creditPercent >= 70
                      ? "bg-(--warn)"
                      : "bg-(--accent)",
                )}
                style={{ width: `${Math.max(1, Math.min(100, creditPercent))}%` }}
              />
            </div>
          ) : null}
          {usage.mediaLimits ? (
            <p className="text-xs leading-5 text-(--text-3)">
              প্রতি ফাইলের সর্বোচ্চ আকার: ছবি{" "}
              {usage.mediaLimits.imageMaxBytes !== null
                ? formatSize(usage.mediaLimits.imageMaxBytes)
                : "অজানা"}
              , ভিডিও{" "}
              {usage.mediaLimits.videoMaxBytes !== null
                ? formatSize(usage.mediaLimits.videoMaxBytes)
                : "অজানা"}
              , ডকুমেন্ট{" "}
              {usage.mediaLimits.rawMaxBytes !== null
                ? formatSize(usage.mediaLimits.rawMaxBytes)
                : "অজানা"}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
