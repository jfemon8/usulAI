import type { ReactNode } from "react";
import { PublicShell } from "@/components/site/PublicShell";
import type { MasalaAuthor } from "@/lib/analytics/verifiedAnswers";
import { formatTimestamp } from "@/lib/utils/dateTime";

export function authorLabel(author: MasalaAuthor | null): string | null {
  if (!author) return null;
  return [author.category, author.name].filter((part) => part.trim()).join(" ") || null;
}

export function publishedLabel(value: string | null): string | null {
  return value ? formatTimestamp(value) : null;
}

export function MasailShell({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
