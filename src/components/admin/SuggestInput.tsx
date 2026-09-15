"use client";

import { useId, useRef, useState, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";
import { Input } from "@/components/admin/ui";

const MENU_MAX_HEIGHT = 224;

export function SuggestInput({
  value,
  onValueChange,
  suggestions,
  className,
  onKeyDown,
  onBlur,
  onFocus,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list"> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: readonly string[];
}) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [above, setAbove] = useState(false);

  const typed = value.trim().toLowerCase();
  const matches = suggestions.filter(
    (suggestion) => suggestion.toLowerCase().includes(typed) && suggestion !== value,
  );
  const visible = open && matches.length > 0;

  function show() {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setAbove(below < MENU_MAX_HEIGHT && rect.top > below);
    }
    setOpen(true);
  }

  function choose(suggestion: string) {
    onValueChange(suggestion);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <Input
        {...props}
        value={value}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={className}
        onChange={(event) => {
          onValueChange(event.target.value);
          setActive(-1);
          show();
        }}
        onFocus={(event) => {
          show();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setOpen(false);
          setActive(-1);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (!visible) {
              show();
            } else {
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((current) => (current + step + matches.length) % matches.length);
            }
            event.preventDefault();
          } else if (event.key === "Enter" && visible && active >= 0) {
            const suggestion = matches[active];
            if (suggestion !== undefined) {
              event.preventDefault();
              choose(suggestion);
            }
          } else if (event.key === "Escape" && visible) {
            event.preventDefault();
            setOpen(false);
          }
          onKeyDown?.(event);
        }}
      />
      {visible ? (
        <ul
          id={listId}
          role="listbox"
          className={clsx(
            "thin-scroll absolute inset-x-0 z-30 overflow-y-auto rounded-xl border border-(--border) bg-(--bg) py-1 shadow-xl",
            above ? "bottom-full mb-1" : "top-full mt-1",
          )}
          style={{ maxHeight: MENU_MAX_HEIGHT }}
        >
          {matches.map((suggestion, index) => (
            <li
              key={suggestion}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => {
                event.preventDefault();
                choose(suggestion);
              }}
              onPointerEnter={() => setActive(index)}
              className={clsx(
                "flex min-h-10 cursor-pointer items-center px-3 font-mono text-sm text-(--text-1)",
                index === active ? "bg-(--accent-soft) text-(--accent)" : "hover:bg-(--surface-2)",
              )}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
