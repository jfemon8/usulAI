import { clsx } from "clsx";
import type { HelpStatus } from "@/lib/help/types";

const LABELS: Record<HelpStatus | "missing" | "loading", string> = {
  open: "অপেক্ষমাণ",
  answered: "উত্তর দেওয়া হয়েছে",
  closed: "বন্ধ",
  missing: "পাওয়া যায়নি",
  loading: "দেখা হচ্ছে…",
};

const TONES: Record<HelpStatus | "missing" | "loading", string> = {
  open: "bg-(--warn-soft) text-(--warn)",
  answered: "bg-(--accent-soft) text-(--accent)",
  closed: "bg-(--surface-2) text-(--text-2)",
  missing: "bg-(--danger-soft) text-(--danger)",
  loading: "bg-(--surface-2) text-(--text-3)",
};

export function HelpStatusBadge({ status }: { status: HelpStatus | "missing" | "loading" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
