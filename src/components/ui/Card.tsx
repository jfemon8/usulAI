import type { HTMLAttributes } from "react";
import { clsx } from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "soft" | "strong";
  sheen?: boolean;
}

export function Card({ className, tone = "default", sheen = true, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "glass glass-card",
        sheen && "glass-sheen",
        tone === "soft" && "glass-soft",
        tone === "strong" && "glass-strong",
        className,
      )}
      {...props}
    />
  );
}
