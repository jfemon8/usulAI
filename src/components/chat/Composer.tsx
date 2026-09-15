"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { clsx } from "clsx";
import { ArrowUpIcon, StopIcon } from "@/components/ui/Icons";
import { RATE_LIMIT_CONFIG } from "@/config/site";
import { commandSuggestions, matchCommand, type ChatCommand } from "@/lib/chat/commands";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCommand?: (command: ChatCommand) => void;
  onStop: () => void;
  busy: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}

export interface ComposerHandle {
  focus: () => void;
}

const MAX_HEIGHT = 208;

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, onChange, onSubmit, onCommand, onStop, busy, autoFocus, compact },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const command = matchCommand(value);
  const canSend =
    (command !== null && onCommand !== undefined) || (!busy && value.trim().length > 0);
  const submit = () => {
    if (command && onCommand) onCommand(command);
    else if (canSend) onSubmit();
  };
  const suggestions = onCommand ? commandSuggestions(value) : [];

  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }), []);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) textareaRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="relative">
      {suggestions.length > 0 && onCommand ? (
        <div
          role="listbox"
          aria-label="কমান্ড"
          className="thin-scroll absolute inset-x-2 bottom-full mb-2 max-h-[min(22rem,55dvh)] overflow-y-auto overscroll-contain rounded-2xl border border-(--border) bg-(--bg) shadow-(--composer-shadow)"
        >
          {suggestions.map((entry) => (
            <button
              key={entry.command}
              type="button"
              role="option"
              aria-selected={entry.command === command}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onCommand(entry.command as ChatCommand)}
              className="flex w-full items-center gap-3 border-b border-(--border) px-4 py-3 text-left transition last:border-b-0 hover:bg-(--surface-2)"
            >
              <code className="rounded-md bg-(--surface-2) px-2 py-0.5 font-mono text-sm text-(--text-1)">
                {entry.command}
              </code>
              <span className="min-w-0 truncate text-sm text-(--text-2)">{entry.description}</span>
            </button>
          ))}
        </div>
      ) : null}
      <form
        className={clsx(
          "flex items-end gap-2 border border-(--border) bg-(--bg) shadow-(--composer-shadow) transition-colors focus-within:border-(--border-strong)",
          compact ? "rounded-3xl p-1.5 ps-3" : "rounded-[28px] p-2 ps-4",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) submit();
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          maxLength={RATE_LIMIT_CONFIG.maxQuestionChars}
          className="thin-scroll max-h-52 min-h-10 flex-1 resize-none bg-transparent py-2 text-base leading-6 text-(--text-1) outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-(--text-3)"
          placeholder="যেকোন মাসআলা জানতে প্রশ্ন করুন…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) submit();
            }
          }}
          aria-label="আপনার প্রশ্ন"
          enterKeyHint="send"
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--text-1) text-(--bg) transition hover:opacity-85 active:scale-95"
            aria-label="উত্তর থামান"
          >
            <StopIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--accent) text-(--accent-contrast) transition hover:bg-(--accent-strong) active:scale-95 disabled:bg-(--surface-3) disabled:text-(--text-3)"
            aria-label="পাঠান"
          >
            <ArrowUpIcon className="h-5 w-5" />
          </button>
        )}
      </form>
    </div>
  );
});
