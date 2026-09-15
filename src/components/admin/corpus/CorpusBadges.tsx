"use client";

import { Badge } from "@/components/admin/ui";
import { CORPUS_SOURCE_LABELS } from "@/components/admin/corpus/types";
import type { SourceType } from "@/types";

export function SourceBadge({ sourceType }: { sourceType: SourceType }) {
  return <Badge tone="accent">{CORPUS_SOURCE_LABELS[sourceType]}</Badge>;
}

export function DocumentFlags({
  embedded,
  adminEdited,
  restricted,
}: {
  embedded: boolean;
  adminEdited: boolean;
  restricted: boolean;
}) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <Badge tone={embedded ? "accent" : "neutral"}>
        {embedded ? "এমবেডিং আছে" : "এমবেডিং নেই"}
      </Badge>
      {adminEdited ? <Badge tone="warn">অ্যাডমিন সম্পাদিত</Badge> : null}
      {restricted ? <Badge tone="danger">সংরক্ষিত বই</Badge> : null}
    </span>
  );
}
