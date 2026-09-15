"use client";

import { useEffect, useId, type ReactNode } from "react";
import { clsx } from "clsx";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-(--text-1)">
          {label}
        </p>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-xs leading-5 text-(--text-3)">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50",
          checked ? "bg-(--accent)" : "bg-(--surface-3)",
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

export function SaveBar({
  dirty,
  message,
  children,
}: {
  dirty: boolean;
  message?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-(--border) bg-(--bg)/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5 sm:pb-3 sm:shadow-lg">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={clsx("text-sm", dirty ? "text-(--warn)" : "text-(--text-3)")}
          aria-live="polite"
        >
          {message ?? (dirty ? "সংরক্ষণ করা হয়নি এমন পরিবর্তন আছে।" : "সব পরিবর্তন সংরক্ষিত।")}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">{children}</div>
      </div>
    </div>
  );
}

export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

export function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={clsx("tabular-nums", over ? "text-(--danger)" : "text-(--text-3)")}>
      {value.length.toLocaleString("bn-BD")}/{max.toLocaleString("bn-BD")}
    </span>
  );
}
