"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Dialog } from "@/components/admin/Dialog";
import { SOURCE_NAMES } from "@/components/admin/labels";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  formatCount,
  formatWhen,
  LoadError,
  PageHeader,
  Select,
  Skeleton,
  Stat,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList } from "@/components/admin/VirtualList";
import { RetryIcon } from "@/components/ui/Icons";
import { SOURCE_PRIORITY } from "@/config/site";
import type { MonitorLogDetail, MonitorLogRow, MonitorSummary } from "@/lib/admin/monitor";

const LANGUAGE_NAMES: Record<string, string> = {
  bangla: "বাংলা",
  banglish: "বাংলিশ",
  other: "অন্যান্য",
};

const RANGE_OPTIONS = [
  { value: "today", label: "আজ" },
  { value: "7d", label: "গত ৭ দিন" },
  { value: "30d", label: "গত ৩০ দিন" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "সব প্রশ্ন" },
  { value: "unanswered", label: "উত্তর বা দলিল মেলেনি" },
  { value: "answered", label: "দলিলসহ উত্তর" },
];

const TIER_NAMES: Record<string, string> = {
  primary: "প্রথম স্তর",
  secondary: "দ্বিতীয় স্তর",
  fallback: "তৃতীয় স্তর",
  reserve: "শেষ স্তর",
};

interface LogPage {
  items: MonitorLogRow[];
  nextCursor: string | null;
}

interface Filters {
  range: string;
  status: string;
  language: string;
  source: string;
  model: string;
}

const DEFAULT_FILTERS: Filters = {
  range: "7d",
  status: "all",
  language: "",
  source: "",
  model: "",
};

function languageName(value: string | null | undefined): string {
  return value ? (LANGUAGE_NAMES[value] ?? value) : "অজানা";
}

function percent(value: number | null): string {
  return value === null ? "নেই" : `${formatCount(Math.round(value * 100))}%`;
}

function StatusBadge({ row }: { row: Pick<MonitorLogRow, "answered" | "noContext"> }) {
  if (!row.answered) return <Badge tone="danger">উত্তর হয়নি</Badge>;
  if (row.noContext) return <Badge tone="warn">দলিল মেলেনি</Badge>;
  return <Badge tone="accent">উত্তর হয়েছে</Badge>;
}

function Summary({ summary }: { summary: MonitorSummary }) {
  const busiestModel = summary.topModels[0]?.count ?? 0;
  return (
    <div className="mb-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="গত ২৪ ঘণ্টায় প্রশ্ন" value={formatCount(summary.count24h)} />
        <Stat label="গত ৭ দিনে প্রশ্ন" value={formatCount(summary.count7d)} />
        <Stat
          label="উত্তর বা দলিল মেলেনি (৭ দিন)"
          value={formatCount(summary.unanswered7d)}
          hint={`মোট প্রশ্নের ${percent(summary.unansweredShare)}`}
          tone={
            summary.unansweredShare !== null && summary.unansweredShare >= 0.3 ? "warn" : undefined
          }
        />
        <Stat
          label="গেটে বাতিল উত্তর (৭ দিন)"
          value={formatCount(summary.gateRejected7d)}
          hint={`মোট ${formatCount(summary.gateRejections7d)}টি প্রত্যাখ্যান`}
        />
        <Stat
          label="পুনরাবৃত্তি কেটে দেওয়া (৭ দিন)"
          value={formatCount(summary.loopCuts7d)}
          tone={summary.loopCuts7d > 0 ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="যে মডেলগুলো উত্তর দিয়েছে" description="গত ৭ দিনে সফল উত্তরের সংখ্যা">
          {summary.topModels.length === 0 ? (
            <EmptyState title="এই সময়ে কোনো উত্তর নেই" />
          ) : (
            <ul className="flex flex-col gap-3">
              {summary.topModels.map((model) => (
                <li key={model.modelId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-(--text-1)" title={model.modelId}>
                      {model.modelId}
                    </span>
                    <span className="shrink-0 text-(--text-2) tabular-nums">
                      {formatCount(model.count)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-(--surface-2)">
                    <div
                      className="h-full rounded-full bg-(--accent)"
                      style={{
                        width: `${busiestModel > 0 ? Math.max(4, (model.count / busiestModel) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="বারবার আসা প্রশ্ন"
          description="রক্ষণাবেক্ষণ চালানোর সময় লগ থেকে জমা হওয়া হিসাব"
        >
          {summary.topQuestions.length === 0 ? (
            <EmptyState title="এখনো কোনো পুনরাবৃত্ত প্রশ্ন জমা হয়নি" />
          ) : (
            <ul className="flex flex-col divide-y divide-(--border)">
              {summary.topQuestions.map((item) => (
                <li key={item.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                  <p className="line-clamp-2 text-sm break-words text-(--text-1)">
                    {item.question}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-(--text-3)">
                    <Badge>{formatCount(item.asked)} বার</Badge>
                    {item.unanswered > 0 ? (
                      <Badge tone="danger">{formatCount(item.unanswered)} বার উত্তর হয়নি</Badge>
                    ) : null}
                    {item.emptyRetrieval > 0 ? (
                      <Badge tone="warn">{formatCount(item.emptyRetrieval)} বার দলিল মেলেনি</Badge>
                    ) : null}
                    <span>শেষ: {formatWhen(item.lastAskedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-(--text-3)">
        {label}
      </label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-(--border) py-2.5 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-xs text-(--text-3) sm:text-sm">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-(--text-1)">{children}</dd>
    </div>
  );
}

function sourceList(values: string[]): string {
  if (values.length === 0) return "নেই";
  return values
    .map((value) => SOURCE_NAMES[value as keyof typeof SOURCE_NAMES] ?? value)
    .join(", ");
}

function LogDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useAdminData<MonitorLogDetail>(id ? `/api/admin/monitor/logs/${id}` : null);
  const log = detail.data && detail.data.id === id ? detail.data : null;

  return (
    <Dialog open={id !== null} onClose={onClose} title="প্রশ্নের বিস্তারিত" size="lg">
      {detail.error ? <LoadError message={detail.error} onRetry={detail.reload} /> : null}
      {!log && !detail.error ? <Skeleton rows={6} /> : null}
      {log ? (
        <dl>
          <DetailRow label="প্রশ্ন">
            <p className="whitespace-pre-wrap">{log.question}</p>
          </DetailRow>
          <DetailRow label="সময়">{formatWhen(log.createdAt)}</DetailRow>
          <DetailRow label="অবস্থা">
            <StatusBadge row={log} />
          </DetailRow>
          <DetailRow label="ভাষা">{languageName(log.language)}</DetailRow>
          <DetailRow label="খোঁজার বাক্য">{log.searchQuery ?? "নেই"}</DetailRow>
          <DetailRow label="প্রশ্ন নতুন করে লেখা">{log.rewritten ? "হ্যাঁ" : "না"}</DetailRow>
          <DetailRow label="আগের কথোপকথন">{formatCount(log.historyTurns)}টি ধাপ</DetailRow>
          <DetailRow label="নির্দিষ্ট উৎসে সীমিত">{sourceList(log.scopedTo)}</DetailRow>
          <DetailRow label="যে উৎস থেকে দলিল">{sourceList(log.sourcesUsed)}</DetailRow>
          <DetailRow label="দলিলের সংখ্যা">
            {formatCount(log.retrievedCount)} (ভেক্টর {formatCount(log.vectorHits)}, টেক্সট{" "}
            {formatCount(log.textHits)})
          </DetailRow>
          <DetailRow label="সর্বোচ্চ স্কোর">
            {log.topScore === null ? "নেই" : log.topScore.toFixed(2)}
          </DetailRow>
          <DetailRow label="সূত্র">
            {log.references.length === 0 ? (
              "নেই"
            ) : (
              <ul className="flex flex-col gap-1">
                {log.references.map((reference, index) => (
                  <li key={`${reference}-${index}`} className="break-words">
                    <span className="me-1.5 text-(--accent) tabular-nums">[{index + 1}]</span>
                    {reference}
                  </li>
                ))}
              </ul>
            )}
          </DetailRow>
          <DetailRow label="উত্তর দেওয়া মডেল">
            {log.modelId ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="break-all">{log.modelId}</span>
                {log.modelTier ? <Badge>{TIER_NAMES[log.modelTier] ?? log.modelTier}</Badge> : null}
                {log.attempt !== null ? (
                  <Badge>{formatCount(log.attempt)} নম্বর চেষ্টা</Badge>
                ) : null}
              </span>
            ) : (
              "কোনো মডেল উত্তর দেয়নি"
            )}
          </DetailRow>
          {log.errorTier ? <DetailRow label="ব্যর্থ স্তর">{log.errorTier}</DetailRow> : null}
          <DetailRow label="গেটে বাতিল">
            {log.rejectionDetails.length === 0 ? (
              "নেই"
            ) : (
              <ul className="flex flex-col gap-2">
                {log.rejectionDetails.map((rejection, index) => (
                  <li
                    key={`${rejection.modelId}-${index}`}
                    className="rounded-lg bg-(--surface-2) px-3 py-2"
                  >
                    <p className="text-xs font-medium break-all">{rejection.modelId}</p>
                    <ul className="mt-1 list-disc ps-4 text-xs text-(--text-2)">
                      {rejection.reasons.map((reason, reasonIndex) => (
                        <li key={reasonIndex} className="break-words">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </DetailRow>
          <DetailRow label="পুনরাবৃত্তি কাটা">{log.loopCut ? "হ্যাঁ" : "না"}</DetailRow>
          {Object.keys(log.timings).length > 0 ? (
            <DetailRow label="সময়ের হিসাব">
              <ul className="flex flex-col gap-0.5 tabular-nums">
                {Object.entries(log.timings).map(([name, value]) => (
                  <li key={name}>
                    {name}: {formatCount(Math.round(value))} মি.সে.
                  </li>
                ))}
              </ul>
            </DetailRow>
          ) : null}
        </dl>
      ) : null}
    </Dialog>
  );
}

export function QueryMonitor() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const closeDetail = useCallback(() => setSelected(null), []);
  const summary = useAdminData<MonitorSummary>("/api/admin/monitor");

  const key = JSON.stringify(filters);
  const feed = useInfiniteAdminData<LogPage, MonitorLogRow>({
    key,
    path: (cursor) => {
      const params = new URLSearchParams();
      for (const [name, value] of Object.entries(filters)) if (value) params.set(name, value);
      if (cursor) params.set("cursor", cursor);
      return `/api/admin/monitor/logs?${params.toString()}`;
    },
    items: (page) => page.items,
    next: (page) => page.nextCursor,
  });

  const update = (name: keyof Filters) => (value: string) =>
    setFilters((current) => ({ ...current, [name]: value }));

  const models = summary.data?.models ?? [];
  const changed = key !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <>
      <PageHeader
        title="প্রশ্ন ও উত্তরের লগ"
        description="পাঠকেরা কী জিজ্ঞেস করছেন, কোন প্রশ্নের উত্তর বা দলিল মেলেনি এবং কোন মডেল উত্তর দিয়েছে। শুধু দেখা যায়, কিছু বদলানো যায় না। লগ ৯০ দিন পর নিজে থেকে মুছে যায়।"
        actions={
          <Button
            size="sm"
            onClick={() => {
              summary.reload();
              feed.reload();
            }}
            icon={<RetryIcon className="h-4 w-4" />}
          >
            হালনাগাদ
          </Button>
        }
      />

      {summary.error && !summary.data ? (
        <div className="mb-5">
          <LoadError message={summary.error} onRetry={summary.reload} />
        </div>
      ) : null}
      {summary.loading && !summary.data ? (
        <div className="mb-5">
          <Skeleton rows={2} />
        </div>
      ) : null}
      {summary.data ? <Summary summary={summary.data} /> : null}

      <Card padded>
        <div className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            id="monitor-range"
            label="সময়"
            value={filters.range}
            onChange={update("range")}
            options={RANGE_OPTIONS}
          />
          <FilterSelect
            id="monitor-status"
            label="অবস্থা"
            value={filters.status}
            onChange={update("status")}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            id="monitor-language"
            label="ভাষা"
            value={filters.language}
            onChange={update("language")}
            options={[
              { value: "", label: "সব ভাষা" },
              ...Object.entries(LANGUAGE_NAMES).map(([value, label]) => ({ value, label })),
            ]}
          />
          <FilterSelect
            id="monitor-source"
            label="নির্দিষ্ট উৎসে সীমিত"
            value={filters.source}
            onChange={update("source")}
            options={[
              { value: "", label: "যেকোনো" },
              ...SOURCE_PRIORITY.map((source) => ({ value: source, label: SOURCE_NAMES[source] })),
            ]}
          />
          <FilterSelect
            id="monitor-model"
            label="উত্তর দেওয়া মডেল"
            value={filters.model}
            onChange={update("model")}
            options={[
              { value: "", label: "সব মডেল" },
              ...(filters.model && !models.includes(filters.model) ? [filters.model] : [])
                .concat(models)
                .map((model) => ({ value: model, label: model })),
            ]}
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-(--text-3)">
          {feed.items.length > 0 ? (
            <span>{formatCount(feed.items.length)}টি দেখানো হচ্ছে</span>
          ) : null}
          {changed ? (
            <Button
              size="sm"
              tone="ghost"
              className="ms-auto"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              ফিল্টার মুছুন
            </Button>
          ) : null}
        </div>

        {feed.loading ? <Skeleton rows={6} /> : null}
        {feed.error && feed.items.length === 0 ? (
          <LoadError message={feed.error} onRetry={feed.retry} />
        ) : null}
        {!feed.loading && !feed.error && feed.items.length === 0 ? (
          <EmptyState title="এই ফিল্টারে কোনো প্রশ্ন নেই">
            সময় বা অবস্থা বদলে আবার দেখুন।
          </EmptyState>
        ) : null}
        {feed.items.length > 0 ? (
          <VirtualDataList
            rows={feed.items}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelected(row.id)}
            hasMore={feed.hasMore}
            loadingMore={feed.loadingMore}
            error={feed.error}
            onLoadMore={feed.loadMore}
            onRetry={feed.retry}
            endLabel="আর কোনো প্রশ্ন নেই"
            estimateRowHeight={64}
            estimateCardHeight={176}
            columns={[
              {
                key: "question",
                label: "প্রশ্ন",
                primary: true,
                width: "minmax(0, 2.6fr)",
                render: (row) => (
                  <span className="line-clamp-2 break-words" title={row.question}>
                    {row.question}
                  </span>
                ),
              },
              {
                key: "status",
                label: "অবস্থা",
                width: "8rem",
                render: (row) => (
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge row={row} />
                    {row.gateRejections > 0 ? (
                      <Badge tone="warn">গেট {formatCount(row.gateRejections)}</Badge>
                    ) : null}
                    {row.loopCut ? <Badge tone="warn">লুপ</Badge> : null}
                  </span>
                ),
              },
              {
                key: "language",
                label: "ভাষা",
                width: "5.5rem",
                render: (row) => languageName(row.language),
              },
              {
                key: "model",
                label: "মডেল",
                width: "minmax(0, 1.2fr)",
                className: "break-all text-xs",
                render: (row) => row.modelId ?? "নেই",
              },
              {
                key: "retrieved",
                label: "দলিল",
                width: "4rem",
                className: "tabular-nums",
                render: (row) => formatCount(row.retrievedCount),
              },
              {
                key: "createdAt",
                label: "সময়",
                width: "12.5rem",
                className: "whitespace-nowrap tabular-nums text-xs",
                render: (row) => formatWhen(row.createdAt),
              },
            ]}
          />
        ) : null}
      </Card>

      <LogDetail id={selected} onClose={closeDetail} />
    </>
  );
}
