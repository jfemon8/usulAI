import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "accent" | "glass";
}

export function Button({ className, variant = "accent", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium",
        "transition duration-200 ease-out active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-45",
        variant === "accent"
          ? "bg-(--accent) text-(--accent-contrast) shadow-[0_10px_26px_-12px_var(--accent-ring)] hover:bg-(--accent-strong)"
          : "glass glass-sheen text-(--text-1) hover:brightness-[1.06]",
        className,
      )}
      {...props}
    />
  );
}
