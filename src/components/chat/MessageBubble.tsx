import type { ReactNode } from "react";
import { clsx } from "clsx";

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  footer?: ReactNode;
}

const ARABIC_RANGE = /[؀-ۿ]/;
const TRANSLATION_LABEL = /^(বাংলা|English)\s*:/;

function renderLines(text: string) {
  return text.split("\n").map((line, index) => {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      return <span key={index} className="block h-2" />;
    }

    const isArabic = ARABIC_RANGE.test(trimmed) && !TRANSLATION_LABEL.test(trimmed);

    return (
      <span key={index} className={clsx("block", isArabic && "arabic my-1")}>
        {line}
      </span>
    );
  });
}

export function MessageBubble({ role, text, footer }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={clsx("rise-in flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[92%] rounded-(--radius-bubble) px-4 py-3 text-[0.9375rem] leading-relaxed sm:max-w-[82%]",
          isUser
            ? "bg-(--accent) text-(--accent-contrast) shadow-[0_14px_30px_-18px_var(--accent-ring)]"
            : "glass glass-sheen glass-strong text-(--text-1)",
        )}
      >
        {renderLines(text)}
        {footer}
      </div>
    </div>
  );
}
