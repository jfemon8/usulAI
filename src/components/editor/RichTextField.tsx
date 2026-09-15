"use client";

import dynamic from "next/dynamic";
import type { RichTextEditorProps } from "@/components/editor/types";

function EditorSkeleton() {
  return (
    <div
      role="status"
      aria-label="সম্পাদক লোড হচ্ছে"
      className="flex min-h-80 flex-col overflow-hidden rounded-xl border border-(--border) bg-(--bg)"
    >
      <div className="flex items-center gap-2 border-b border-(--border) p-2">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-(--surface-2)" />
        <div className="ms-auto h-9 w-9 animate-pulse rounded-lg bg-(--surface-2)" />
      </div>
      <div className="flex gap-1.5 border-b border-(--border) p-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-(--surface-2)" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-(--surface-2)" />
        <div className="h-4 w-full animate-pulse rounded bg-(--surface-2)" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-(--surface-2)" />
      </div>
    </div>
  );
}

const RichTextEditor = dynamic(() => import("@/components/editor/RichTextEditor"), {
  ssr: false,
  loading: EditorSkeleton,
});

export function RichTextField(props: RichTextEditorProps) {
  return <RichTextEditor {...props} />;
}
