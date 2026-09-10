import type { ReactNode } from "react";
import { clsx } from "clsx";
import { AnswerMarkdown } from "@/components/chat/AnswerMarkdown";

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  footer?: ReactNode;
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
        {isUser ? (
          <span className="whitespace-pre-wrap">{text}</span>
        ) : (
          <AnswerMarkdown text={text} />
        )}
        {footer}
      </div>
    </div>
  );
}
