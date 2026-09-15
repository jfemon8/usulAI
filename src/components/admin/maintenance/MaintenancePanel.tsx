"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import { RateLimitCard } from "@/components/admin/maintenance/RateLimitCard";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  formatCount,
  formatSize,
  formatWhen,
  Input,
  LoadError,
  Notice,
  PageHeader,
  Skeleton,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import {
  DatabaseIcon,
  RetryIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
  WrenchIcon,
} from "@/components/ui/Icons";
import type { MaintenanceOverview, ModelHealthRow } from "@/lib/admin/maintenance";
import type { MaintenanceReport } from "@/lib/maintenance/retention";

type Overview = MaintenanceOverview;
type Storage = NonNullable<Overview["storage"]>;
type Memory = NonNullable<Overview["memory"]>;
type Models = NonNullable<Overview["models"]>;

type Pending =
  | { kind: "run" }
  | { kind: "cooldowns" }
  | { kind: "forget"; topic?: string; question?: string; label: string }
  | { kind: "clear-memory" }
  | { kind: "clear-embeddings" };

const TIER_NAMES: Record<string, string> = {
  primary: "প্রথম স্তর",
  secondary: "দ্বিতীয় স্তর",
  fallback: "তৃতীয় স্তর",
  reserve: "শেষ স্তর",
};

const KIND_NAMES: Record<string, string> = {
  rewrite: "প্রশ্ন পুনর্লিখন",
  verdict: "দলিল বাছাই",
};

function percent(ratio: number): string {
  return `${formatCount(Math.round(ratio * 1000) / 10)}%`;
}

function Meter({ ratio, warn, danger }: { ratio: number; warn: number; danger: number }) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-(--surface-2)"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <div
        className={clsx(
          "h-full rounded-full transition-[width]",
          ratio >= danger ? "bg-(--danger)" : ratio >= warn ? "bg-(--warn)" : "bg-(--accent)",
        )}
        style={{ width: `${Math.min(100, Math.max(1, ratio * 100))}%` }}
      />
    </div>
  );
}

function Blocked({ message }: { message: string }) {
  return <Notice tone="warn">{message}</Notice>;
}

function StorageCard({ storage }: { storage: Storage | null }) {
  return (
    <Card
      title="ডাটাবেসের জায়গা"
      description="Atlas M0-এর ৫১২ MB সীমার মধ্যে ডেটা ও ইনডেক্স মিলিয়ে কতটা ব্যবহার হচ্ছে।"
    >
      {!storage ? (
        <Blocked message="জায়গার হিসাব এখন আনা যায়নি।" />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold text-(--text-1) tabular-nums">
              {percent(storage.ratio)}
            </p>
            <p className="text-sm text-(--text-2) tabular-nums">
              {formatSize(storage.usedBytes)} / {formatSize(storage.quotaBytes)}
            </p>
          </div>
          <Meter ratio={storage.ratio} warn={storage.warnRatio} danger={storage.evictAtRatio} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-(--text-3)">ডেটা</dt>
              <dd className="text-(--text-1) tabular-nums">{formatSize(storage.dataBytes)}</dd>
            </div>
            <div>
              <dt className="text-xs text-(--text-3)">ইনডেক্স</dt>
              <dd className="text-(--text-1) tabular-nums">{formatSize(storage.indexBytes)}</dd>
            </div>
            <div>
              <dt className="text-xs text-(--text-3)">কালেকশন</dt>
              <dd className="text-(--text-1) tabular-nums">
                {formatCount(storage.collectionCount)}টি
              </dd>
            </div>
            <div>
              <dt className="text-xs text-(--text-3)">শেষ রক্ষণাবেক্ষণ</dt>
              <dd className="text-(--text-1)">{formatWhen(storage.lastMaintenanceAt)}</dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-(--text-3)">
            ব্যবহার {percent(storage.evictAtRatio)} পার হলে রক্ষণাবেক্ষণ অব্যবহৃত দলিলের এমবেডিং
            সরিয়ে {percent(storage.targetRatio)}-এ নামিয়ে আনে। লেখা কখনো মোছে না, দরকার হলে
            এমবেডিং আবার তৈরি হয়।
          </p>
        </div>
      )}
    </Card>
  );
}

const REPORT_ROWS: { key: keyof MaintenanceReport; label: string }[] = [
  { key: "insightsRolledUp", label: "লগ থেকে জমা হওয়া প্রশ্নের হিসাব" },
  { key: "queryEmbeddingsCapped", label: "সীমার বাইরে মুছে ফেলা প্রশ্ন-ভেক্টর" },
  { key: "feedbackDrained", label: "গণনায় যোগ হওয়া মতামত" },
  { key: "talliesPruned", label: "মুছে ফেলা পুরনো মতামতের হিসাব" },
  { key: "signalsPruned", label: "মুছে ফেলা নিরপেক্ষ র‍্যাংকিং সংকেত" },
  { key: "embeddingsEvicted", label: "সরানো অব্যবহৃত এমবেডিং" },
  { key: "passagesPretranslated", label: "আগাম অনুবাদ হওয়া বইয়ের অনুচ্ছেদ" },
];

function ReportView({ report }: { report: MaintenanceReport }) {
  return (
    <div className="rounded-xl border border-(--border) p-3.5 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={report.dryRun ? "neutral" : "accent"}>
          {report.dryRun ? "পরীক্ষামূলক ফলাফল, কিছু বদলানো হয়নি" : "চালানো হয়েছে"}
        </Badge>
        <span className="text-xs text-(--text-3)">
          {report.dryRun
            ? "নিচের সংখ্যাগুলো আসলে চালালে কী হবে তার আনুমানিক হিসাব।"
            : "নিচের সংখ্যাগুলো এইমাত্র যা করা হয়েছে তার হিসাব।"}
        </span>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3">
          <dt className="text-(--text-2)">আগে ব্যবহৃত জায়গা</dt>
          <dd className="text-(--text-1) tabular-nums">{formatSize(report.usedBefore)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-(--text-2)">পরে ব্যবহৃত জায়গা</dt>
          <dd className="text-(--text-1) tabular-nums">
            {formatSize(report.usedAfter)} ({percent(report.ratio)})
          </dd>
        </div>
        {REPORT_ROWS.map((row) => (
          <div key={row.key} className="flex justify-between gap-3">
            <dt className="text-(--text-2)">{row.label}</dt>
            <dd className="text-(--text-1) tabular-nums">{formatCount(Number(report[row.key]))}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RunCard({
  report,
  busy,
  onDryRun,
  onRun,
}: {
  report: MaintenanceReport | null;
  busy: "dry" | "run" | null;
  onDryRun: () => void;
  onRun: () => void;
}) {
  const previewed = report?.dryRun === true;
  return (
    <Card
      title="রক্ষণাবেক্ষণ চালান"
      description="পুরনো এমবেডিং, নিরপেক্ষ সংকেত ও হিসাব মুছে ফেলে ডাটাবেসের জায়গা খালি করে।"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={onDryRun}
            loading={busy === "dry"}
            disabled={busy !== null}
            icon={<SearchIcon className="h-4 w-4" />}
          >
            আগে পরীক্ষা করে দেখুন
          </Button>
          <Button
            tone="primary"
            onClick={onRun}
            loading={busy === "run"}
            disabled={busy !== null || !previewed}
            icon={<WrenchIcon className="h-4 w-4" />}
          >
            এখনই চালান
          </Button>
        </div>
        {!previewed && !report ? (
          <p className="text-xs text-(--text-3)">
            আসলে চালানোর আগে পরীক্ষামূলকভাবে চালিয়ে দেখুন কী কী বদলাবে।
          </p>
        ) : null}
        {busy === "run" ? (
          <p className="text-xs text-(--text-3)" role="status">
            চলছে। অনুবাদসহ কয়েক মিনিট লাগতে পারে, পাতা বন্ধ করবেন না।
          </p>
        ) : null}
        {report ? <ReportView report={report} /> : null}
      </div>
    </Card>
  );
}

function ModelRow({ model, minAttempts }: { model: ModelHealthRow; minAttempts: number }) {
  const attempts = model.answered + model.rejected;
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium break-all text-(--text-1)">{model.modelId}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {model.tier ? <Badge>{TIER_NAMES[model.tier] ?? model.tier}</Badge> : null}
          {!model.inChain ? <Badge>চেইনে নেই</Badge> : null}
          {model.inChain && !model.keyConfigured ? <Badge tone="warn">কী সেট করা নেই</Badge> : null}
          {model.disabled ? <Badge tone="warn">বন্ধ রাখা</Badge> : null}
          {model.coolingDown ? <Badge tone="danger">বিরতিতে</Badge> : null}
          {model.demoted ? <Badge tone="warn">পিছনে সরানো</Badge> : null}
        </div>
      </div>
      <div className="shrink-0 text-xs text-(--text-2) tabular-nums sm:text-end">
        <p>
          উত্তর {formatCount(model.answered)} · বাতিল {formatCount(model.rejected)}
        </p>
        <p className="text-(--text-3)">
          {model.successRatio === null
            ? `সফলতার হার দেখাতে ${formatCount(minAttempts)}টি চেষ্টা লাগে (${formatCount(attempts)}টি হয়েছে)`
            : `সফলতা ${percent(model.successRatio)}`}
        </p>
      </div>
    </li>
  );
}

function ModelsCard({
  models,
  busy,
  onClear,
}: {
  models: Models | null;
  busy: boolean;
  onClear: () => void;
}) {
  const cooling = models?.models.filter((model) => model.coolingDown).length ?? 0;
  return (
    <Card
      title="মডেলের অবস্থা"
      description={`কোন মডেল ব্যর্থ হয়ে সাময়িক বিরতিতে আছে এবং কে কতবার উত্তর দিয়েছে বা গেটে বাতিল হয়েছে। সফলতা ${models ? percent(models.demoteBelow) : ""}-এর নিচে নামলে মডেলটি চেইনের শেষে চলে যায়।`}
      actions={
        <Button
          size="sm"
          onClick={onClear}
          loading={busy}
          disabled={!models || cooling === 0}
          icon={<RetryIcon className="h-4 w-4" />}
        >
          বিরতি তুলে দিন
        </Button>
      }
    >
      {!models ? (
        <Blocked message="মডেলের তথ্য এখন আনা যায়নি।" />
      ) : models.models.length === 0 ? (
        <EmptyState title="কোনো মডেল কনফিগার করা নেই" />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-(--border)">
            {models.models.map((model) => (
              <ModelRow key={model.modelId} model={model} minAttempts={models.minAttempts} />
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-(--text-3)">
            বিরতির হিসাব প্রতিটি সার্ভার ইনস্ট্যান্সে আলাদা থাকে, তাই এখানে এই ইনস্ট্যান্সেরটাই দেখা
            ও মোছা যায়। উত্তরের হিসাব ডাটাবেসে জমা থাকে।
          </p>
        </>
      )}
    </Card>
  );
}

function MemoryCard({
  memory,
  busy,
  onForget,
  onClear,
}: {
  memory: Memory | null;
  busy: boolean;
  onForget: (input: { topic?: string; question?: string; label: string }) => void;
  onClear: () => void;
}) {
  const [question, setQuestion] = useState("");
  const learned = memory ? memory.rewrites + memory.verdicts : 0;

  return (
    <Card
      title="শেখা তথ্য"
      description={`প্রশ্ন কীভাবে খোঁজার বাক্যে বদলানো হয়েছে এবং কোন দলিল প্রাসঙ্গিক ধরা হয়েছে, তা মনে রাখা হয় যাতে একই প্রশ্নে একই উত্তর আসে। ${memory ? formatCount(memory.memoryDays) : ""} দিন ব্যবহার না হলে নিজে থেকে মুছে যায়।`}
      actions={
        <Button
          size="sm"
          tone="danger"
          onClick={onClear}
          disabled={!memory || learned === 0 || busy}
          icon={<TrashIcon className="h-4 w-4" />}
        >
          সব মুছুন
        </Button>
      }
    >
      {!memory ? (
        <Blocked message="শেখা তথ্যের হিসাব এখন আনা যায়নি।" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge>পুনর্লিখন {formatCount(memory.rewrites)}</Badge>
            <Badge>দলিল বাছাই {formatCount(memory.verdicts)}</Badge>
            <Badge tone="accent">মডেলের হিসাব {formatCount(memory.models)} (মোছা হয় না)</Badge>
          </div>

          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const value = question.trim();
              if (value) onForget({ question: value, label: value });
            }}
          >
            <Field
              label="একটি প্রশ্নের শেখা তথ্য মুছুন"
              hint="ভুল উত্তর বারবার আসছে এমন প্রশ্নটি লিখুন। একই বিষয়ের সব শেখা তথ্য মুছে যাবে।"
              className="min-w-0 flex-1"
            >
              {(id) => (
                <Input
                  id={id}
                  value={question}
                  maxLength={2000}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="যেমন: সফরে কসর নামাজ কত দিন পড়া যাবে?"
                />
              )}
            </Field>
            <Button type="submit" disabled={!question.trim() || busy} className="sm:mb-6">
              ভুলে যান
            </Button>
          </form>

          {memory.topics.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-(--text-3)">সম্প্রতি ব্যবহৃত বিষয়</p>
              <ul className="flex flex-col divide-y divide-(--border) rounded-xl border border-(--border)">
                {memory.topics.map((topic) => (
                  <li
                    key={topic.topic}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm break-words text-(--text-1)">
                        {topic.topic}
                      </p>
                      <p className="mt-0.5 text-xs text-(--text-3)">
                        {topic.kinds.map((kind) => KIND_NAMES[kind] ?? kind).join(", ")} ·{" "}
                        {formatWhen(topic.lastUsedAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      tone="ghost"
                      disabled={busy}
                      onClick={() => onForget({ topic: topic.topic, label: topic.topic })}
                      className="self-end sm:self-auto"
                    >
                      ভুলে যান
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title="এখনো কিছু শেখা হয়নি" />
          )}
        </div>
      )}
    </Card>
  );
}

function EmbeddingCacheCard({
  count,
  busy,
  onClear,
}: {
  count: number | null;
  busy: boolean;
  onClear: () => void;
}) {
  return (
    <Card
      title="প্রশ্নের ভেক্টর ক্যাশ"
      description="আগে জিজ্ঞাসিত প্রশ্নের এমবেডিং জমা থাকে, যাতে একই প্রশ্নে আবার দৈনিক কোটা খরচ না হয়। মুছলে পরের প্রশ্নগুলোতে নতুন করে এমবেডিং লাগবে।"
      actions={
        <Button
          size="sm"
          tone="danger"
          onClick={onClear}
          disabled={count === null || count === 0 || busy}
          icon={<TrashIcon className="h-4 w-4" />}
        >
          খালি করুন
        </Button>
      }
    >
      {count === null ? (
        <Blocked message="ক্যাশের হিসাব এখন আনা যায়নি।" />
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--surface-2) text-(--text-2)">
            <DatabaseIcon className="h-5 w-5" />
          </span>
          <p className="text-sm text-(--text-2)">
            <span className="text-xl font-semibold text-(--text-1) tabular-nums">
              {formatCount(count)}
            </span>{" "}
            টি প্রশ্নের ভেক্টর জমা আছে
          </p>
        </div>
      )}
    </Card>
  );
}

const CONFIRM_COPY: Record<
  Pending["kind"],
  { title: string; confirm: string; tone: "danger" | "primary" }
> = {
  run: { title: "রক্ষণাবেক্ষণ চালাবেন?", confirm: "চালান", tone: "primary" },
  cooldowns: { title: "মডেলের বিরতি তুলে দেবেন?", confirm: "তুলে দিন", tone: "primary" },
  forget: { title: "এই বিষয়ের শেখা তথ্য মুছবেন?", confirm: "মুছুন", tone: "danger" },
  "clear-memory": { title: "সব শেখা তথ্য মুছবেন?", confirm: "সব মুছুন", tone: "danger" },
  "clear-embeddings": { title: "ভেক্টর ক্যাশ খালি করবেন?", confirm: "খালি করুন", tone: "danger" },
};

function confirmMessage(pending: Pending, report: MaintenanceReport | null) {
  switch (pending.kind) {
    case "run":
      return report?.embeddingsEvicted
        ? `পরীক্ষায় দেখা গেছে ${formatCount(report.embeddingsEvicted)}টি এমবেডিং সরানো হবে। পুরনো ক্যাশ ও হিসাবও মুছে যাবে।`
        : "পুরনো ক্যাশ, নিরপেক্ষ সংকেত ও হিসাব মুছে যাবে এবং লগের হিসাব জমা হবে।";
    case "cooldowns":
      return "ব্যর্থ হওয়া মডেলগুলো আবার সঙ্গে সঙ্গে চেষ্টা করা হবে। সমস্যা না মিটলে আবার বিরতিতে চলে যাবে।";
    case "forget":
      return (
        <>
          <span className="block break-words text-(--text-1)">{pending.label}</span>
          <span className="mt-2 block">
            পরের বার এই বিষয়ের প্রশ্নে খোঁজার বাক্য ও দলিল বাছাই নতুন করে করা হবে।
          </span>
        </>
      );
    case "clear-memory":
      return "সব প্রশ্নের শেখা পুনর্লিখন ও দলিল বাছাই মুছে যাবে। মডেলের সফলতার হিসাব থাকবে। এর পর কিছুদিন বেশি মডেল কল হবে।";
    case "clear-embeddings":
      return "জমা থাকা সব প্রশ্নের এমবেডিং মুছে যাবে। আবার জিজ্ঞাসিত হলে নতুন করে এমবেডিং তৈরি হবে এবং দৈনিক কোটা খরচ হবে।";
  }
}

export function MaintenancePanel() {
  const toast = useToast();
  const overview = useAdminData<Overview>("/api/admin/maintenance");
  const [report, setReport] = useState<MaintenanceReport | null>(null);
  const [running, setRunning] = useState<"dry" | "run" | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);
  const closeConfirm = useCallback(() => setPending(null), []);

  async function dryRun() {
    setRunning("dry");
    try {
      setReport(
        await adminApi<MaintenanceReport>("/api/admin/maintenance/run", {
          body: { dryRun: true },
        }),
      );
      toast.success("পরীক্ষামূলক ফলাফল তৈরি হয়েছে।");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRunning(null);
    }
  }

  async function perform(action: Pending) {
    if (action.kind === "run") {
      setPending(null);
      setRunning("run");
      try {
        setReport(
          await adminApi<MaintenanceReport>("/api/admin/maintenance/run", {
            body: { dryRun: false },
          }),
        );
        toast.success("রক্ষণাবেক্ষণ সম্পন্ন হয়েছে।");
        overview.reload();
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setRunning(null);
      }
      return;
    }

    setWorking(true);
    try {
      if (action.kind === "cooldowns") {
        const result = await adminApi<{ cleared: number }>("/api/admin/maintenance/models", {
          method: "DELETE",
        });
        toast.success(`${formatCount(result.cleared)}টি মডেলের বিরতি তুলে দেওয়া হয়েছে।`);
      } else if (action.kind === "forget") {
        const result = await adminApi<{ topic: string; removed: number }>(
          "/api/admin/maintenance/memory",
          { body: { topic: action.topic, question: action.question } },
        );
        toast.success(`এই বিষয়ের ${formatCount(result.removed)}টি শেখা তথ্য মুছে ফেলা হয়েছে।`);
      } else if (action.kind === "clear-memory") {
        const result = await adminApi<{ removed: number }>("/api/admin/maintenance/memory", {
          method: "DELETE",
        });
        toast.success(`${formatCount(result.removed)}টি শেখা তথ্য মুছে ফেলা হয়েছে।`);
      } else {
        const result = await adminApi<{ removed: number }>(
          "/api/admin/maintenance/query-embeddings",
          { method: "DELETE" },
        );
        toast.success(`${formatCount(result.removed)}টি প্রশ্নের ভেক্টর মুছে ফেলা হয়েছে।`);
      }
      setPending(null);
      overview.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  const data = overview.data;
  const copy = pending ? CONFIRM_COPY[pending.kind] : null;

  return (
    <>
      <PageHeader
        title="রক্ষণাবেক্ষণ"
        description="সাইট সচল রাখার কাজগুলো এক জায়গায়। মুছে ফেলার আগে প্রতিটি কাজে নিশ্চিত করতে বলা হবে, এবং প্রতিটি কাজ অডিট লগে জমা থাকে।"
        actions={
          <Button
            size="sm"
            onClick={overview.reload}
            loading={overview.loading && data !== null}
            icon={<RetryIcon className="h-4 w-4" />}
          >
            হালনাগাদ
          </Button>
        }
      />

      {overview.error && !data ? (
        <div className="mb-5">
          <LoadError message={overview.error} onRetry={overview.reload} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {data ? (
          <StorageCard storage={data.storage} />
        ) : overview.loading ? (
          <Card title="ডাটাবেসের জায়গা">
            <Skeleton rows={2} />
          </Card>
        ) : null}

        <RunCard
          report={report}
          busy={running}
          onDryRun={() => void dryRun()}
          onRun={() => setPending({ kind: "run" })}
        />

        {data ? (
          <>
            <ModelsCard
              models={data.models}
              busy={working && pending?.kind === "cooldowns"}
              onClear={() => setPending({ kind: "cooldowns" })}
            />
            <div className="flex flex-col gap-4">
              <MemoryCard
                memory={data.memory}
                busy={working}
                onForget={(input) => setPending({ kind: "forget", ...input })}
                onClear={() => setPending({ kind: "clear-memory" })}
              />
              <EmbeddingCacheCard
                count={data.queryEmbeddings?.count ?? null}
                busy={working}
                onClear={() => setPending({ kind: "clear-embeddings" })}
              />
            </div>
          </>
        ) : overview.loading ? (
          <>
            <Card title="মডেলের অবস্থা">
              <Skeleton rows={3} />
            </Card>
            <Card title="শেখা তথ্য">
              <Skeleton rows={3} />
            </Card>
          </>
        ) : null}
      </div>

      <div className="mt-4">
        <RateLimitCard />
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-(--text-3)">
        <SparklesIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        শেখা তথ্য ও ভেক্টর মুছলে ডাটাবেস থেকে মুছে যায়। অন্য সার্ভার ইনস্ট্যান্সের মেমরিতে থাকা কপি
        সেগুলো পুনরায় চালু হওয়া পর্যন্ত থাকতে পারে।
      </p>

      {pending && copy ? (
        <ConfirmDialog
          open
          title={copy.title}
          message={confirmMessage(pending, report)}
          confirmLabel={copy.confirm}
          tone={copy.tone}
          busy={working}
          onConfirm={() => void perform(pending)}
          onClose={closeConfirm}
        />
      ) : null}
    </>
  );
}
