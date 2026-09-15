"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { clsx } from "clsx";
import { AskScholarDialog } from "@/components/help/AskScholarDialog";
import {
  CheckIcon,
  CopyIcon,
  FlagIcon,
  QuestionIcon,
  RetryIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "@/components/ui/Icons";
import { prepareAnswer } from "@/lib/ai/answerText";
import { answerKey, feedbackStore } from "@/lib/chat/feedbackStore";
import type { AnswerSource } from "@/types";

type Verdict = "helpful" | "unhelpful" | "wrong-citation";

interface MessageActionsProps {
  question: string;
  answer: string;
  sources: AnswerSource[];
  onRetry?: () => void;
}

function ActionButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        "flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-(--surface-2) hover:text-(--text-1) disabled:pointer-events-none",
        active ? "text-(--accent)" : "text-(--text-3) disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

export function MessageActions({ question, answer, sources, onRetry }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const votes = useSyncExternalStore(
    feedbackStore.subscribe,
    feedbackStore.getSnapshot,
    feedbackStore.getServerSnapshot,
  );
  const key = answerKey(question, answer);
  const verdict: Verdict | null = votes[key]?.verdict ?? null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);

  async function copy() {
    const references = sources.map((source) => `[${source.index}] ${source.reference}`).join("\n");
    const text = references
      ? `${prepareAnswer(answer)}\n\nসূত্র:\n${references}`
      : prepareAnswer(answer);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function sendFeedback(next: Verdict) {
    if (busy || verdict) return;
    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict: next,
          question,
          answer,
          sources: sources.map(({ index, sourceType, reference }) => ({
            index,
            sourceType,
            reference,
          })),
        }),
      });
      if (response.ok) {
        feedbackStore.save(key, next);
      } else if (response.status === 409) {
        const payload = (await response.json().catch(() => null)) as { verdict?: Verdict } | null;
        feedbackStore.save(key, payload?.verdict ?? next);
        setNotice("এই উত্তরে আপনি আগেই মতামত দিয়েছেন।");
      } else {
        setNotice("মতামত পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন।");
      }
    } catch {
      setNotice("মতামত পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-0.5">
      <ActionButton label={copied ? "কপি হয়েছে" : "কপি করুন"} onClick={copy}>
        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
      </ActionButton>

      {onRetry ? (
        <ActionButton label="আবার উত্তর তৈরি করুন" onClick={onRetry}>
          <RetryIcon className="h-4 w-4" />
        </ActionButton>
      ) : null}

      <ActionButton
        label="সহায়ক"
        onClick={() => sendFeedback("helpful")}
        active={verdict === "helpful"}
        disabled={busy || verdict !== null}
      >
        <ThumbUpIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label="সহায়ক নয়"
        onClick={() => sendFeedback("unhelpful")}
        active={verdict === "unhelpful"}
        disabled={busy || verdict !== null}
      >
        <ThumbDownIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label="সূত্র ভুল"
        onClick={() => sendFeedback("wrong-citation")}
        active={verdict === "wrong-citation"}
        disabled={busy || verdict !== null}
      >
        <FlagIcon className="h-4 w-4" />
      </ActionButton>

      {notice ? (
        <span className="ms-1.5 text-xs text-(--text-3)" role="status">
          {notice}
        </span>
      ) : verdict === "helpful" ? (
        <span className="ms-1.5 text-xs text-(--text-3)" role="status">
          ধন্যবাদ, আপনার মতামত রাখা হলো।
        </span>
      ) : null}

      {verdict === "unhelpful" || verdict === "wrong-citation" ? (
        <div
          role="status"
          className="rise-in mt-1.5 flex w-full flex-col gap-2 rounded-xl border border-(--border) bg-(--surface-2) px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs leading-5 text-(--text-2)">
            ধন্যবাদ, উত্তরটি আলেমদের পর্যালোচনায় পাঠানো হয়েছে। নিজের প্রশ্নের নির্ভরযোগ্য উত্তর
            চাইলে সরাসরি আলেমের কাছে পাঠাতে পারেন।
          </p>
          <button
            type="button"
            onClick={() => setAskOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-(--accent) px-3 text-xs font-medium text-(--accent-contrast) transition hover:bg-(--accent-strong)"
          >
            <QuestionIcon className="h-4 w-4 shrink-0" />
            আলেমের কাছে প্রশ্ন পাঠান
          </button>
        </div>
      ) : null}

      <AskScholarDialog
        open={askOpen}
        onClose={() => setAskOpen(false)}
        initialQuestion={question}
        context={{
          aiAnswer: answer,
          references: [...sources]
            .sort((a, b) => a.index - b.index)
            .map((source) => source.reference),
        }}
      />
    </div>
  );
}
