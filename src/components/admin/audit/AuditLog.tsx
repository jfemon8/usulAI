"use client";

import { useState } from "react";
import { actionLabel } from "@/components/admin/labels";
import {
  Button,
  Card,
  EmptyState,
  formatWhen,
  LoadError,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/admin/ui";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList } from "@/components/admin/VirtualList";
import { RetryIcon } from "@/components/ui/Icons";
import { ADMIN_CONFIG } from "@/config/site";

interface AuditRow {
  id: string;
  at: string;
  email: string;
  action: string;
  target: string | null;
  detail: string | null;
}

interface AuditPage {
  items: AuditRow[];
  nextBefore: string | null;
}

export function AuditLog() {
  const [email, setEmail] = useState("");
  const feed = useInfiniteAdminData<AuditPage, AuditRow>({
    key: `audit:${email}`,
    path: (cursor) => {
      const params = new URLSearchParams();
      if (cursor) params.set("before", cursor);
      if (email) params.set("email", email);
      const query = params.toString();
      return `/api/admin/audit${query ? `?${query}` : ""}`;
    },
    items: (page) => page.items,
    next: (page) => page.nextBefore,
  });

  return (
    <>
      <PageHeader
        title="অডিট লগ"
        description={`অ্যাডমিনদের প্রতিটি লগইন ও পরিবর্তনের হিসাব। ${ADMIN_CONFIG.auditDays} দিন পর স্বয়ংক্রিয়ভাবে মুছে যায়।`}
        actions={
          <Button size="sm" onClick={feed.reload} icon={<RetryIcon className="h-4 w-4" />}>
            হালনাগাদ
          </Button>
        }
      />
      <Card padded>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="audit-email" className="text-sm text-(--text-2)">
            অ্যাডমিন
          </label>
          <Select
            id="audit-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="sm:max-w-xs"
          >
            <option value="">সবাই</option>
            {ADMIN_CONFIG.accounts.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </Select>
          {feed.items.length > 0 ? (
            <span className="text-xs text-(--text-3) sm:ms-auto">
              {feed.items.length}টি দেখানো হচ্ছে
            </span>
          ) : null}
        </div>

        {feed.loading ? <Skeleton rows={5} /> : null}
        {feed.error && feed.items.length === 0 ? (
          <LoadError message={feed.error} onRetry={feed.retry} />
        ) : null}
        {!feed.loading && !feed.error && feed.items.length === 0 ? (
          <EmptyState title="কোনো কার্যক্রম পাওয়া যায়নি" />
        ) : null}
        {feed.items.length > 0 ? (
          <VirtualDataList
            rows={feed.items}
            rowKey={(row) => row.id}
            hasMore={feed.hasMore}
            loadingMore={feed.loadingMore}
            error={feed.error}
            onLoadMore={feed.loadMore}
            onRetry={feed.retry}
            endLabel="আর কোনো কার্যক্রম নেই"
            estimateRowHeight={52}
            estimateCardHeight={150}
            columns={[
              {
                key: "action",
                label: "কাজ",
                primary: true,
                width: "minmax(0, 1.2fr)",
                render: (row) => actionLabel(row.action),
              },
              {
                key: "target",
                label: "লক্ষ্য",
                width: "minmax(0, 1.4fr)",
                className: "break-all",
                render: (row) => row.target ?? "নেই",
              },
              {
                key: "detail",
                label: "বিস্তারিত",
                width: "minmax(0, 1.2fr)",
                className: "break-words",
                render: (row) => row.detail ?? "নেই",
              },
              {
                key: "email",
                label: "অ্যাডমিন",
                width: "minmax(0, 1.2fr)",
                className: "break-all",
                render: (row) => row.email,
              },
              {
                key: "at",
                label: "সময়",
                width: "13.5rem",
                className: "whitespace-nowrap tabular-nums",
                render: (row) => formatWhen(row.at),
              },
            ]}
          />
        ) : null}
      </Card>
    </>
  );
}
