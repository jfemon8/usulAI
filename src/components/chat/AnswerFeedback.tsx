"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { AnswerSource } from "@/types";

type Verdict = "helpful" | "unhelpful" | "wrong-citation";

interface AnswerFeedbackProps {
  question: string;
  answer: string;
  sources: AnswerSource[];
}

const BUTTON_CLASS =
  "glass glass-sheen inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] text-(--text-2) transition duration-200 hover:brightness-[1.08] active:scale-[0.97] disabled:pointer-events-none";

export function AnswerFeedback({ question, answer, sources }: AnswerFeedbackProps) {
  const [sent, setSent] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(verdict: Verdict) {
    if (busy || sent) return;
    setBusy(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict,
          question,
          answer,
          sources: sources.map((source) => ({
            index: source.index,
            sourceType: source.sourceType,
            reference: source.reference,
          })),
        }),
      });

      if (response.ok) setSent(verdict);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="mt-2 text-[0.6875rem] text-(--text-3)">
        {sent === "helpful"
          ? "ধন্যবাদ, আপনার মতামত রাখা হলো।"
          : "ধন্যবাদ — এটি পর্যালোচনার জন্য পাঠানো হয়েছে।"}
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[0.6875rem] text-(--text-3)">উত্তরটি কি সহায়ক ছিল?</span>
      <button
        type="button"
        onClick={() => send("helpful")}
        disabled={busy}
        className={BUTTON_CLASS}
        aria-label="সহায়ক"
      >
        <span aria-hidden="true">👍</span>
      </button>
      <button
        type="button"
        onClick={() => send("unhelpful")}
        disabled={busy}
        className={BUTTON_CLASS}
        aria-label="সহায়ক নয়"
      >
        <span aria-hidden="true">👎</span>
      </button>
      <button
        type="button"
        onClick={() => send("wrong-citation")}
        disabled={busy}
        className={clsx(BUTTON_CLASS, "text-(--text-3)")}
      >
        সূত্র ভুল
      </button>
    </div>
  );
}
