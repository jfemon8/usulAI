import { clsx } from "clsx";
import { AnswerMarkdown } from "@/components/chat/AnswerMarkdown";

export function RichContent({ text, className }: { text: string; className?: string }) {
  return (
    <div className={clsx("rich-content min-w-0", className)}>
      <AnswerMarkdown text={text} authored />
    </div>
  );
}
