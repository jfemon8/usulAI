"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { RichContent } from "@/components/editor/RichContent";
import { SourceCitationList } from "@/components/chat/SourceCitation";
import { HelpStatusBadge } from "@/components/help/HelpStatusBadge";
import {
  AlertIcon,
  BadgeCheckIcon,
  CheckIcon,
  ChevronLeftIcon,
  RetryIcon,
} from "@/components/ui/Icons";
import { HELP_CONFIG } from "@/config/site";
import { helpRequestStore } from "@/lib/help/clientStore";
import { HELP_CLOSE_REASON_LABELS, type PublicHelpView } from "@/lib/help/types";
import { formatTimestamp } from "@/lib/utils/dateTime";

type LoadState =
  | { phase: "loading" }
  | { phase: "missing"; message: string }
  | { phase: "error"; message: string }
  | { phase: "ready"; view: PublicHelpView };

const FALLBACK_ERROR = "প্রশ্নের অবস্থা এখন আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।";

async function loadView(token: string): Promise<LoadState> {
  try {
    const response = await fetch(`/api/help/${encodeURIComponent(token)}`, { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as
      (PublicHelpView & { error?: string }) | null;
    if (response.status === 404) {
      return { phase: "missing", message: body?.error ?? "প্রশ্নটি পাওয়া যায়নি।" };
    }
    if (!response.ok || !body || body.error) {
      return { phase: "error", message: body?.error ?? FALLBACK_ERROR };
    }
    return { phase: "ready", view: body };
  } catch {
    return { phase: "error", message: FALLBACK_ERROR };
  }
}

interface Step {
  title: string;
  detail?: string | null;
  state: "done" | "current" | "waiting";
}

function stepsFor(view: PublicHelpView): Step[] {
  const sent: Step = {
    title: "প্রশ্ন পাঠানো হয়েছে",
    detail: formatTimestamp(view.createdAt),
    state: "done",
  };
  if (view.status === "closed") {
    return [
      sent,
      {
        title: "প্রশ্নটি বন্ধ করা হয়েছে",
        detail: view.closedAt ? formatTimestamp(view.closedAt) : null,
        state: "current",
      },
    ];
  }
  if (view.status === "answered") {
    return [
      sent,
      { title: "আলেমগণ পর্যালোচনা করেছেন", state: "done" },
      {
        title: "উত্তর দেওয়া হয়েছে",
        detail: view.answeredAt ? formatTimestamp(view.answeredAt) : null,
        state: "done",
      },
    ];
  }
  return [
    sent,
    {
      title: "আলেমদের কাছে অপেক্ষমাণ",
      detail: "একজন আলেম প্রশ্নটি দেখে উত্তর লিখবেন, ইং-শা-আল্লাহ।",
      state: "current",
    },
    { title: "উত্তর দেওয়া হবে", state: "waiting" },
  ];
}

function Timeline({ view }: { view: PublicHelpView }) {
  const steps = stepsFor(view);
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className={clsx(
                "absolute start-[0.6875rem] top-6 bottom-0 w-px",
                step.state === "done" ? "bg-(--accent)" : "bg-(--border)",
              )}
            />
          ) : null}
          <span
            aria-hidden="true"
            className={clsx(
              "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
              step.state === "done" && "border-(--accent) bg-(--accent) text-(--accent-contrast)",
              step.state === "current" && "border-(--accent) bg-(--accent-soft) text-(--accent)",
              step.state === "waiting" && "border-(--border) bg-(--bg) text-(--text-3)",
            )}
          >
            {step.state === "done" ? (
              <CheckIcon className="h-3.5 w-3.5" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-current" />
            )}
          </span>
          <div className="min-w-0 pt-0.5">
            <p
              className={clsx(
                "text-sm font-medium",
                step.state === "waiting" ? "text-(--text-3)" : "text-(--text-1)",
              )}
            >
              {step.title}
              <span className="sr-only">
                {step.state === "done"
                  ? " (সম্পন্ন)"
                  : step.state === "current"
                    ? " (বর্তমান ধাপ)"
                    : " (বাকি)"}
              </span>
            </p>
            {step.detail ? (
              <p className="mt-0.5 text-xs leading-5 text-(--text-3) tabular-nums">{step.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx("rounded-2xl border border-(--border) bg-(--bg) p-4 sm:p-5", className)}
    >
      <h2 className="mb-3 text-sm font-semibold text-(--text-2)">{title}</h2>
      {children}
    </section>
  );
}

export function HelpTracker({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    void loadView(token).then((result) => {
      if (!active) return;
      setState(result);
      setRefreshing(false);
      if (result.phase === "ready") {
        helpRequestStore.remember(token, result.view.question, result.view.createdAt);
      }
    });
    return () => {
      active = false;
    };
  }, [token, version]);

  function refresh() {
    setRefreshing(true);
    setVersion((value) => value + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={HELP_CONFIG.path}
        className="inline-flex w-fit items-center gap-1 text-sm text-(--text-2) hover:text-(--text-1)"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        আমার প্রশ্নগুলো
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">প্রশ্নের অবস্থা</h1>
          {state.phase === "ready" ? (
            <div className="mt-2">
              <HelpStatusBadge status={state.view.status} />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={state.phase === "loading" || refreshing}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-(--border) px-3 text-sm text-(--text-2) transition hover:bg-(--surface-2) disabled:opacity-60 sm:h-10"
        >
          <RetryIcon
            className={clsx(
              "h-4 w-4",
              (state.phase === "loading" || refreshing) &&
                "animate-spin motion-reduce:animate-none",
            )}
          />
          <span>হালনাগাদ</span>
        </button>
      </div>

      {state.phase === "loading" ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl bg-(--surface-2) motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : state.phase === "missing" || state.phase === "error" ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl bg-(--danger-soft) px-4 py-4 text-sm leading-6 text-(--danger)"
        >
          <AlertIcon className="mt-1 h-4 w-4 shrink-0" />
          <p>{state.message}</p>
        </div>
      ) : (
        <>
          <Section title="অগ্রগতি">
            <Timeline view={state.view} />
          </Section>

          <Section title="আপনার প্রশ্ন">
            <p dir="auto" className="text-base leading-7 break-words whitespace-pre-wrap">
              {state.view.question}
            </p>
            {state.view.details ? (
              <p
                dir="auto"
                className="mt-3 border-t border-(--border) pt-3 text-sm leading-6 break-words whitespace-pre-wrap text-(--text-2)"
              >
                {state.view.details}
              </p>
            ) : null}
          </Section>

          {state.view.status === "answered" && state.view.answer ? (
            <Section title="আলেমের উত্তর">
              {state.view.answeredBy ? (
                <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-(--accent-soft) px-3 py-2 text-sm text-(--text-1)">
                  <BadgeCheckIcon className="h-4 w-4 shrink-0 text-(--accent)" />
                  <span>
                    যাচাই করেছেন: {state.view.answeredBy.category} {state.view.answeredBy.name}
                  </span>
                </p>
              ) : null}
              <div className="min-w-0">
                <RichContent text={state.view.answer} />
              </div>
              {state.view.sources.length > 0 ? (
                <SourceCitationList sources={state.view.sources} />
              ) : null}
              {state.view.masalaPath ? (
                <Link
                  href={state.view.masalaPath}
                  className="mt-4 inline-flex text-sm font-medium text-(--accent) underline-offset-4 hover:underline"
                >
                  মাসআলা হিসেবে প্রকাশিত উত্তরটি দেখুন
                </Link>
              ) : null}
            </Section>
          ) : null}

          {state.view.status === "closed" ? (
            <Section title="প্রশ্নটি বন্ধ করা হয়েছে">
              <p className="text-sm leading-6">
                কারণ:{" "}
                {state.view.closedReason
                  ? HELP_CLOSE_REASON_LABELS[state.view.closedReason]
                  : "উল্লেখ করা হয়নি"}
              </p>
              {state.view.closedNote ? (
                <p
                  dir="auto"
                  className="mt-2 rounded-xl bg-(--surface-2) px-3 py-2 text-sm leading-6 break-words whitespace-pre-wrap text-(--text-2)"
                >
                  {state.view.closedNote}
                </p>
              ) : null}
            </Section>
          ) : null}

          <p className="text-xs leading-5 text-(--text-3)">
            উত্তরটি আপনার পাঠানো তথ্যের ভিত্তিতে দেওয়া। ব্যক্তিগত, পারিবারিক বা জটিল বিষয়ে (যেমন
            তালাক, মিরাস বা লেনদেনের বিরোধ) সব দিক জেনে সিদ্ধান্ত নিতে সরাসরি একজন নির্ভরযোগ্য
            মুফতির সাথে পরামর্শ করুন। এই লিংকটি গোপন রাখুন, লিংক থাকলে যে কেউ প্রশ্ন ও উত্তর দেখতে
            পারবে। উত্তর দেওয়া বা বন্ধ হওয়ার{" "}
            {HELP_CONFIG.answeredRetentionDays.toLocaleString("bn-BD")} দিন পর প্রশ্নটি
            স্বয়ংক্রিয়ভাবে মুছে যায়।
          </p>
        </>
      )}
    </div>
  );
}
