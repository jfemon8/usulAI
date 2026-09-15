import type { AnswerSource } from "@/types";

export type ReviewVerdict = "unhelpful" | "wrong-citation";

export interface ClaimView {
  name: string;
  category: string;
  at: string;
  expiresAt: string;
  mine: boolean;
}

export interface ReviewSummary {
  id: string;
  question: string;
  excerpt: string;
  count: number;
  unhelpful: number;
  wrongCitation: number;
  implicit: number;
  noteCount: number;
  sourceCount: number;
  createdAt: string;
  lastFlaggedAt: string;
  claim: ClaimView | null;
}

export interface ReviewDetailData extends ReviewSummary {
  answer: string;
  topic: string;
  sources: AnswerSource[];
  notes: { text: string; verdict: ReviewVerdict; origin: "explicit" | "implicit"; at: string }[];
}

export interface ReviewStats {
  open: number;
  claimed: number;
  mine: number;
  wrongCitation: number;
}

export interface ReviewPage {
  items: ReviewSummary[];
  nextCursor: string | null;
  stats: ReviewStats | null;
}

export interface ResolutionResult {
  action: "confirm" | "correct" | "dismiss";
  question: string;
  masalaId: string | null;
  published: boolean;
  detail: string;
}
