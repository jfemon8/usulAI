import { BadgeCheckIcon, ExternalLinkIcon } from "@/components/ui/Icons";
import type { VerifiedInfo } from "@/types";

export function VerifiedBadge({ info }: { info: VerifiedInfo }) {
  const by = [info.authorCategory, info.authorName].filter(Boolean).join(" ");

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-(--accent-soft) px-3 py-1 text-xs font-medium text-(--accent)">
        <BadgeCheckIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">যাচাই করেছেন: {by}</span>
      </span>
      {info.path ? (
        <a
          href={info.path}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-xs font-medium text-(--text-2) underline-offset-2 transition hover:text-(--accent) hover:underline"
        >
          মাসআলাটি দেখুন
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}
