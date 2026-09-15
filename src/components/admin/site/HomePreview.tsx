"use client";

import { AnnouncementView } from "@/components/chat/AnnouncementBanner";
import { LogoMark } from "@/components/ui/Logo";
import type { HomeContent } from "@/lib/site/contentShape";

export function HomePreview({ content }: { content: HomeContent }) {
  const suggestions = content.suggestions.filter((question) => question.trim()).slice(0, 4);
  const showBanner = content.announcement.enabled && content.announcement.text.trim().length > 0;

  return (
    <div className="overflow-hidden rounded-b-2xl">
      {showBanner ? <AnnouncementView announcement={content.announcement} /> : null}
      <div className="flex flex-col items-center px-4 py-6 text-center sm:px-5">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-(--border) text-(--accent)">
          <LogoMark className="h-7 w-7" />
        </div>
        {content.bismillah ? (
          <p className="arabic mb-1 text-center text-(--text-2)" dir="rtl">
            {content.bismillah}
          </p>
        ) : null}
        <p className="text-lg font-semibold tracking-tight break-words text-(--text-1)">
          {content.greeting || "শুভেচ্ছা বাক্য"}
        </p>
        {content.subtitle ? (
          <p className="mt-2 text-sm text-balance break-words text-(--text-3)">
            {content.subtitle}
          </p>
        ) : null}
        {suggestions.length > 0 ? (
          <div className="mt-5 grid w-full gap-2 text-start">
            {suggestions.map((question, index) => (
              <div
                key={`${index}-${question}`}
                className="rounded-2xl border border-(--border) px-3.5 py-2.5 text-sm break-words text-(--text-2)"
              >
                {question}
              </div>
            ))}
          </div>
        ) : null}
        {content.suggestions.length > 4 ? (
          <p className="mt-3 text-xs text-(--text-3)">
            প্রিভিউতে প্রথম ৪টি দেখানো হচ্ছে; সাইটে প্রতিবার এলোমেলোভাবে বাছাই হয়।
          </p>
        ) : null}
      </div>
    </div>
  );
}
