"use client";

import { useState } from "react";
import { SourceViewer } from "@/components/chat/SourceViewer";
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

function isViewable(source: AnswerSource): boolean {
  return Boolean(source.url) && (source.media === "image" || source.media === "pdf");
}

function chipBody(source: AnswerSource) {
  return (
    <>
      <span className="text-(--accent) tabular-nums">[{source.index}]</span>
      <span className="truncate">
        {SOURCE_LABELS[source.sourceType]} · {source.reference}
      </span>
    </>
  );
}

export function SourceCitationList({ sources }: { sources: AnswerSource[] }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewable = sources.filter(isViewable);

  if (sources.length === 0) {
    return (
      <p className="mt-3 border-t border-(--glass-border) pt-2.5 text-xs text-(--text-3)">
        কোনো সোর্স পাওয়া যায়নি, তাই এই উত্তরের ভিত্তি যাচাই করা যাচ্ছে না।
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-(--glass-border) pt-2.5">
      <p className="text-faint mb-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase">
        সূত্র
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source) => {
          const title = `${SOURCE_LABELS[source.sourceType]} · ${source.reference}`;

          if (isViewable(source)) {
            return (
              <button
                key={source.index}
                type="button"
                title={title}
                onClick={() =>
                  setViewerIndex(viewable.findIndex((item) => item.index === source.index))
                }
                className={`${CHIP_CLASS} active:scale-[0.97]`}
              >
                {chipBody(source)}
                <span aria-hidden="true" className="text-faint">
                  ⤢
                </span>
              </button>
            );
          }

          if (source.url) {
            return (
              <a
                key={source.index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                title={title}
                className={CHIP_CLASS}
              >
                {chipBody(source)}
                <span aria-hidden="true" className="text-faint">
                  ↗
                </span>
              </a>
            );
          }

          return (
            <span key={source.index} title={title} className={CHIP_CLASS}>
              {chipBody(source)}
            </span>
          );
        })}
      </div>

      {viewerIndex !== null && viewerIndex >= 0 ? (
        <SourceViewer
          sources={viewable}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </div>
  );
}
