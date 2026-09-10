import type { AnswerSource, SourceType } from "@/types";

const SOURCE_LABELS: Record<SourceType, string> = {
  quran: "কুরআন",
  hadith: "হাদিস",
  ijma: "ইজমা",
  qiyas: "কিয়াস",
  sirat: "সীরাত",
};

const CHIP_CLASS =
  "glass glass-sheen inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium text-(--text-1) transition duration-200 hover:brightness-[1.08]";

export function SourceCitation({ source }: { source: AnswerSource }) {
  const content = (
    <>
      <span className="text-(--accent) tabular-nums">[{source.index}]</span>
      <span className="truncate">
        {SOURCE_LABELS[source.sourceType]} · {source.reference}
      </span>
    </>
  );

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={CHIP_CLASS}
        title={`${SOURCE_LABELS[source.sourceType]} · ${source.reference}`}
      >
        {content}
        <span aria-hidden="true" className="text-faint">
          ↗
        </span>
      </a>
    );
  }

  return (
    <span
      className={CHIP_CLASS}
      title={`${SOURCE_LABELS[source.sourceType]} · ${source.reference}`}
    >
      {content}
    </span>
  );
}

export function SourceCitationList({ sources }: { sources: AnswerSource[] }) {
  if (sources.length === 0) {
    return (
      <p className="mt-3 border-t border-(--glass-border) pt-2.5 text-xs text-(--text-3)">
        কোনো সোর্স না পাওয়ায় এই উত্তরের ভিত্তি যাচাই করা যাচ্ছে না।
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-(--glass-border) pt-2.5">
      <p className="text-faint mb-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase">
        সূত্র
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <SourceCitation key={source.index} source={source} />
        ))}
      </div>
    </div>
  );
}
