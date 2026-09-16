"use client";

import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { clsx } from "clsx";
import { AlertIcon, RetryIcon } from "@/components/ui/Icons";
import { formatTimestamp } from "@/lib/utils/dateTime";

type Tone = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_TONES: Record<Tone, string> = {
  primary:
    "bg-(--accent) text-(--accent-contrast) hover:bg-(--accent-strong) disabled:bg-(--surface-3) disabled:text-(--text-3)",
  secondary:
    "border border-(--border) bg-(--bg) text-(--text-1) hover:bg-(--surface-2) disabled:text-(--text-3)",
  danger:
    "bg-(--danger) text-white hover:opacity-90 disabled:bg-(--surface-3) disabled:text-(--text-3)",
  ghost: "text-(--text-2) hover:bg-(--surface-2) hover:text-(--text-1) disabled:text-(--text-3)",
};

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: Tone;
    size?: "sm" | "md";
    loading?: boolean;
    icon?: ReactNode;
  }
>(function Button(
  { tone = "secondary", size = "md", loading, icon, className, children, disabled, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition active:scale-[0.98] disabled:active:scale-100",
        size === "sm" ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm",
        BUTTON_TONES[tone],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1) disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const CONTROL =
  "w-full rounded-xl border border-(--border) bg-(--bg) px-3 text-base text-(--text-1) outline-none transition placeholder:text-(--text-3) focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft) disabled:bg-(--surface-2) disabled:text-(--text-3) sm:text-sm";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(CONTROL, "h-11 sm:h-10", className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={clsx(CONTROL, "thin-scroll min-h-24 py-2.5 leading-6", className)}
      {...props}
    />
  );
});

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(CONTROL, "h-11 pe-8 sm:h-10", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-(--text-1)">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs leading-5 text-(--danger)">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-5 text-(--text-3)">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={clsx("min-w-0 rounded-2xl border border-(--border) bg-(--bg)", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-(--border) px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-(--text-1)">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-(--text-3)">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={padded ? "p-4 sm:p-5" : undefined}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-balance text-(--text-1) sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-5xl text-sm text-(--text-3)">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-(--surface-2) text-(--text-2)",
  accent: "bg-(--accent-soft) text-(--accent)",
  warn: "bg-(--warn-soft) text-(--warn)",
  danger: "bg-(--danger-soft) text-(--danger)",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = "neutral",
  children,
  action,
}: {
  tone?: "neutral" | "warn" | "danger";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={clsx(
        "flex flex-col gap-3 rounded-xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        tone === "danger"
          ? "bg-(--danger-soft) text-(--danger)"
          : tone === "warn"
            ? "bg-(--warn-soft) text-(--warn)"
            : "bg-(--surface-2) text-(--text-2)",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {tone !== "neutral" ? <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> : null}
        <div className="min-w-0 break-words">{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Notice
      tone="danger"
      action={
        <Button size="sm" onClick={onRetry} icon={<RetryIcon className="h-4 w-4" />}>
          আবার চেষ্টা
        </Button>
      }
    >
      {message}
    </Notice>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
      <p className="text-sm font-medium text-(--text-1)">{title}</p>
      {children ? <div className="max-w-xl text-sm text-(--text-3)">{children}</div> : null}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-xl bg-(--surface-2) motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "warn" | "danger";
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-(--border) bg-(--bg) px-4 py-3.5">
      <p className="truncate text-xs text-(--text-3)">{label}</p>
      <p
        className={clsx(
          "mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl",
          tone === "danger"
            ? "text-(--danger)"
            : tone === "warn"
              ? "text-(--warn)"
              : "text-(--text-1)",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-(--text-3)">{hint}</p> : null}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
  primary?: boolean;
}

export function DataList<T>({
  rows,
  columns,
  rowKey,
  actions,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary);

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-(--border) text-start text-xs text-(--text-3)">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={clsx("px-3 py-2.5 text-start font-medium", column.className)}
                >
                  {column.label}
                </th>
              ))}
              {actions ? <th className="w-px px-3 py-2.5" aria-label="কাজ" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  "border-b border-(--border) last:border-b-0",
                  onRowClick && "cursor-pointer hover:bg-(--surface-2)",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx("px-3 py-3 align-top text-(--text-1)", column.className)}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {actions ? (
                  <td className="px-3 py-2 align-top" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1">{actions(row)}</div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={clsx(
              "rounded-xl border border-(--border) p-3.5",
              onRowClick && "active:bg-(--surface-2)",
            )}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {primary ? (
              <div className="text-sm font-medium break-words text-(--text-1)">
                {primary.render(row)}
              </div>
            ) : null}
            {secondary.length > 0 ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {secondary.map((column) => (
                  <div key={column.key} className="contents">
                    <dt className="text-(--text-3)">{column.label}</dt>
                    <dd className="min-w-0 break-words text-(--text-1)">{column.render(row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {actions ? (
              <div
                className="mt-3 flex flex-wrap justify-end gap-1 border-t border-(--border) pt-2"
                onClick={(event) => event.stopPropagation()}
              >
                {actions(row)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

const numberFormat = new Intl.NumberFormat("bn-BD");

export function formatWhen(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return "নেই";
  return formatTimestamp(value) ?? "নেই";
}

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${numberFormat.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${numberFormat.format(Math.round(bytes / 102.4) / 10)} KB`;
  if (bytes < 1024 ** 3)
    return `${numberFormat.format(Math.round(bytes / (1024 * 102.4)) / 10)} MB`;
  return `${numberFormat.format(Math.round(bytes / (1024 ** 2 * 102.4)) / 10)} GB`;
}
