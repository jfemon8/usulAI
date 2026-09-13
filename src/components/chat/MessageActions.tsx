"use client";

import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import {
  CheckIcon,
  CopyIcon,
  FlagIcon,
  RetryIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "@/components/ui/Icons";
import { prepareAnswer } from "@/lib/ai/answerText";
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
        active ? "text-(--accent)" : "text-(--text-3)",
      )}
    >
      {children}
    </button>
  );
}

export function MessageActions({ question, answer, sources, onRetry }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);

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
      if (response.ok) setVerdict(next);
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
        disabled={busy || (verdict !== null && verdict !== "helpful")}
      >
        <ThumbUpIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label="সহায়ক নয়"
        onClick={() => sendFeedback("unhelpful")}
        active={verdict === "unhelpful"}
        disabled={busy || (verdict !== null && verdict !== "unhelpful")}
      >
        <ThumbDownIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label="সূত্র ভুল"
        onClick={() => sendFeedback("wrong-citation")}
        active={verdict === "wrong-citation"}
        disabled={busy || (verdict !== null && verdict !== "wrong-citation")}
      >
        <FlagIcon className="h-4 w-4" />
      </ActionButton>

      {verdict ? (
        <span className="ms-1.5 text-xs text-(--text-3)" role="status">
          {verdict === "helpful"
            ? "ধন্যবাদ, আপনার মতামত রাখা হলো।"
            : "ধন্যবাদ, এটি পর্যালোচনার জন্য পাঠানো হয়েছে।"}
        </span>
      ) : null}
    </div>
  );
}
