"use client";

import { useRef, useState } from "react";
import { SourceViewer } from "@/components/chat/SourceViewer";
import { FileTextIcon } from "@/components/ui/Icons";
import { prefetchRenderedSource } from "@/lib/sourceView/clientPdf";
import type { AnswerSource, SourceType } from "@/types";

const SOURCE_LABELS: Record<SourceType, string> = {
  quran: "কুরআন",
  hadith: "হাদিস",
  ijma: "ইজমা",
  qiyas: "কিয়াস",
  sirat: "সীরাত",
};

const CHIP_CLASS =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-(--border) bg-(--bg) px-3 py-1.5 text-xs font-medium text-(--text-2) transition hover:border-(--border-strong) hover:bg-(--surface-2) hover:text-(--text-1)";

function chipBody(source: AnswerSource) {
  return (
    <>
      <span className="text-(--accent) tabular-nums">[{source.index}]</span>
      <span className="truncate">
        {SOURCE_LABELS[source.sourceType]} · {source.reference}
        {source.grade ? ` · ${source.grade}` : ""}
      </span>
    </>
  );
}

export function SourceCitationList({ sources }: { sources: AnswerSource[] }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const schedulePrefetch = (reference: string) => {
    clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => prefetchRenderedSource(reference), 200);
  };
  const cancelPrefetch = () => clearTimeout(prefetchTimer.current);

  if (sources.length === 0) {
    return (
      <p className="mt-4 text-xs text-(--text-3)">
        কোনো সোর্স পাওয়া যায়নি, তাই এই উত্তরের ভিত্তি যাচাই করা যাচ্ছে না।
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-(--text-3)">সূত্র</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const title = `${SOURCE_LABELS[source.sourceType]} · ${source.reference}${source.grade ? ` · ${source.grade}` : ""}`;

          return (
            <button
              key={source.index}
              type="button"
              title={`${title} · মূল পাতা দেখুন`}
              aria-haspopup="dialog"
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") schedulePrefetch(source.reference);
              }}
              onPointerLeave={cancelPrefetch}
              onFocus={() => schedulePrefetch(source.reference)}
              onBlur={cancelPrefetch}
              onClick={() => {
                cancelPrefetch();
                setViewerIndex(sources.findIndex((item) => item.index === source.index));
              }}
              className={`${CHIP_CLASS} active:scale-[0.97]`}
            >
              {chipBody(source)}
              <FileTextIcon className="h-3.5 w-3.5 shrink-0 text-(--text-3)" />
            </button>
          );
        })}
      </div>

      {viewerIndex !== null && viewerIndex >= 0 ? (
        <SourceViewer
          sources={sources}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </div>
  );
}
