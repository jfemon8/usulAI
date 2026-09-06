"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const MAX_HEIGHT = 160;

export function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && value.trim().length > 0;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  return (
    <form
      className="glass glass-sheen glass-strong flex items-end gap-2 rounded-(--radius-card) p-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        className="max-h-40 flex-1 resize-none bg-transparent px-2.5 py-2 text-[0.9375rem] leading-relaxed text-(--text-1) outline-none placeholder:text-(--text-3)"
        placeholder="আপনার প্রশ্ন লিখুন..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        disabled={disabled}
        aria-label="আপনার প্রশ্ন"
      />

      <Button
        type="submit"
        disabled={!canSend}
        className="h-10 w-10 shrink-0 p-0"
        aria-label="পাঠান"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M5 12h13M12 5l7 7-7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Button>
    </form>
  );
}
