"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { Button, formatCount, formatSize } from "@/components/admin/ui";
import { locateJsonError, utf8Bytes } from "@/components/admin/database/jsonText";
import { ADMIN_CONFIG } from "@/config/site";

export function JsonEditor({
  id,
  value,
  onChange,
  label,
  allowEmpty = false,
  disabled = false,
  minRows = 14,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  minRows?: number;
  className?: string;
}) {
  const [wrap, setWrap] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const problem = locateJsonError(value, { allowEmpty });
  const bytes = utf8Bytes(value);
  const tooLarge = bytes > ADMIN_CONFIG.maxJsonDocumentBytes;
  const lines = value.split("\n").length;

  const jumpToError = () => {
    const textarea = textareaRef.current;
    if (!textarea || problem?.offset === null || problem?.offset === undefined) return;
    textarea.focus();
    textarea.setSelectionRange(problem.offset, Math.min(value.length, problem.offset + 1));
  };

  return (
    <div className={clsx("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-(--text-3) tabular-nums">
          {formatCount(lines)} লাইন, {formatSize(bytes)}
        </span>
        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-(--text-2)">
          <input
            type="checkbox"
            checked={wrap}
            onChange={(event) => setWrap(event.target.checked)}
            className="h-4 w-4 accent-(--accent)"
          />
          লাইন মোড়ানো
        </label>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        aria-label={label}
        aria-invalid={problem !== null || tooLarge}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        wrap={wrap ? "soft" : "off"}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        dir="ltr"
        className={clsx(
          "thin-scroll min-h-48 w-full resize-y overflow-auto rounded-xl border bg-(--surface-2) px-3 py-2.5 font-mono text-[13px] leading-5 text-(--text-1) transition outline-none focus:ring-2 focus:ring-(--accent-soft) disabled:text-(--text-3)",
          wrap ? "break-all whitespace-pre-wrap" : "whitespace-pre",
          problem || tooLarge
            ? "border-(--danger) focus:border-(--danger)"
            : "border-(--border) focus:border-(--accent)",
        )}
      />
      {problem ? (
        <div className="flex flex-col gap-2 rounded-xl bg-(--danger-soft) px-3 py-2 text-xs leading-5 text-(--danger) sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 break-words" role="alert">
            {problem.message}
          </span>
          {problem.offset !== null ? (
            <Button size="sm" tone="ghost" onClick={jumpToError} className="self-start">
              ত্রুটির জায়গায় যান
            </Button>
          ) : null}
        </div>
      ) : tooLarge ? (
        <p className="text-xs text-(--danger)" role="alert">
          নথিটি {formatSize(ADMIN_CONFIG.maxJsonDocumentBytes)} এর চেয়ে বড়।
        </p>
      ) : (
        <p className="text-xs text-(--text-3)">JSON সঠিক আছে।</p>
      )}
    </div>
  );
}

export function jsonEditorIsValid(value: string, allowEmpty = false): boolean {
  return (
    locateJsonError(value, { allowEmpty }) === null &&
    utf8Bytes(value) <= ADMIN_CONFIG.maxJsonDocumentBytes
  );
}
