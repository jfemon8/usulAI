"use client";

import type { ClaimView, ReviewSummary } from "@/components/admin/reviews/types";
import { Badge, formatCount, formatWhen } from "@/components/admin/ui";

export function FlagBadges({
  row,
}: {
  row: Pick<ReviewSummary, "unhelpful" | "wrongCitation" | "implicit">;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {row.unhelpful > 0 ? (
        <Badge tone="warn">সহায়ক নয় {formatCount(row.unhelpful)}</Badge>
      ) : null}
      {row.wrongCitation > 0 ? (
        <Badge tone="danger">সূত্র ভুল {formatCount(row.wrongCitation)}</Badge>
      ) : null}
      {row.implicit > 0 ? <Badge>কথোপকথনে অভিযোগ {formatCount(row.implicit)}</Badge> : null}
    </span>
  );
}

export function ClaimBadge({ claim }: { claim: ClaimView | null }) {
  if (!claim) return <Badge>কেউ নেননি</Badge>;
  if (claim.mine) return <Badge tone="accent">আপনি দেখছেন</Badge>;
  return (
    <span className="break-words" title={`মেয়াদ ${formatWhen(claim.expiresAt)} পর্যন্ত`}>
      <Badge tone="warn">
        {claim.category} {claim.name}
      </Badge>
    </span>
  );
}
