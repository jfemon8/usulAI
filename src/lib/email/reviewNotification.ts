import { EMAIL_CONFIG } from "@/config/site";
import { sendEmail, type OutgoingEmail } from "@/lib/email/mailer";
import { getEmailEnv } from "@/lib/utils/env";
import type { AnswerSource } from "@/types";

export interface ReviewItem {
  verdict: "unhelpful" | "wrong-citation";
  origin: "explicit" | "implicit";
  question: string;
  answer: string;
  sources: readonly Pick<AnswerSource, "reference">[];
  note?: string;
}

const VERDICT_LABELS: Record<ReviewItem["verdict"], string> = {
  unhelpful: "উত্তর সহায়ক নয়",
  "wrong-citation": "সূত্র ভুল",
};

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > EMAIL_CONFIG.maxQuoteChars
    ? `${trimmed.slice(0, EMAIL_CONFIG.maxQuoteChars)}…`
    : trimmed;
}

export function reviewNotification(item: ReviewItem, to: string): OutgoingEmail {
  const source = item.origin === "implicit" ? "ইউজারের পরের মেসেজ থেকে" : "ফিডব্যাক বাটন থেকে";
  const references =
    item.sources.length > 0
      ? item.sources.map((entry, index) => `${index + 1}. ${entry.reference}`).join("\n")
      : "(কোনো সূত্র ছিল না)";

  return {
    to,
    subject: `Usul AI রিভিউ: ${VERDICT_LABELS[item.verdict]} | ${clip(item.question).slice(0, 60)}`,
    category: EMAIL_CONFIG.categories.reviewQueue,
    text: [
      `নতুন একটি উত্তর রিভিউয়ের অপেক্ষায় (${VERDICT_LABELS[item.verdict]}, ${source})।`,
      "",
      "প্রশ্ন:",
      clip(item.question),
      ...(item.note ? ["", "ইউজারের মন্তব্য:", clip(item.note)] : []),
      "",
      "উত্তর:",
      clip(item.answer),
      "",
      "সূত্র:",
      references,
      "",
      "রিভিউ করতে GET /api/feedback (x-review-secret হেডারসহ) দেখুন।",
    ].join("\n"),
  };
}

export async function notifyReviewQueue(item: ReviewItem): Promise<boolean> {
  const to = getEmailEnv().REVIEW_NOTIFY_EMAIL;
  if (!to || !getEmailEnv().MAILTRAP_API_TOKEN) return false;
  return (await sendEmail(reviewNotification(item, to))).sent;
}
