import { clsx } from "clsx";

interface LogoMarkProps {
  className?: string;
  label?: string;
}

export function LogoMark({ className, label }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      className={clsx("h-full w-full", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <g opacity="0.3">
        <rect x="15" y="15" width="34" height="34" rx="3" />
        <rect x="15" y="15" width="34" height="34" rx="3" transform="rotate(45 32 32)" />
      </g>
      <g opacity="0.55">
        <rect x="22" y="22" width="20" height="20" rx="2.5" />
        <rect x="22" y="22" width="20" height="20" rx="2.5" transform="rotate(45 32 32)" />
      </g>
      <rect x="27.5" y="27.5" width="9" height="9" rx="1.5" transform="rotate(45 32 32)" />
    </svg>
  );
}

export function LogoBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "glass glass-sheen flex shrink-0 items-center justify-center rounded-xl text-(--accent)",
        className,
      )}
    >
      <LogoMark className="h-[64%] w-[64%]" />
    </span>
  );
}
