import type { AnswerSource, SourceType } from "@/types";

export type HelpStatus = "open" | "answered" | "closed";

export const HELP_FILTERS = ["open", "claimed", "mine", "answered", "closed", "all"] as const;

export type HelpFilter = (typeof HELP_FILTERS)[number];

export const HELP_FILTER_LABELS: Record<HelpFilter, string> = {
  open: "অপেক্ষমাণ",
  claimed: "কেউ দেখছেন",
  mine: "আমি দেখছি",
  answered: "উত্তর দেওয়া",
  closed: "বন্ধ",
  all: "সব",
};

export const HELP_CLOSE_REASONS = [
  "duplicate",
  "not-islamic",
  "personal-consultation",
  "insufficient",
  "other",
] as const;

export type HelpCloseReason = (typeof HELP_CLOSE_REASONS)[number];

export const HELP_CLOSE_REASON_LABELS: Record<HelpCloseReason, string> = {
  duplicate: "একই প্রশ্ন আগে এসেছে বা উত্তর দেওয়া আছে",
  "not-islamic": "প্রশ্নটি ইসলামি বিষয়ে নয়",
  "personal-consultation": "সরাসরি একজন মুফতির সাথে পরামর্শ প্রয়োজন",
  insufficient: "প্রশ্ন বোঝার মতো যথেষ্ট তথ্য নেই",
  other: "অন্যান্য কারণ",
};

export const HELP_STATUS_LABELS: Record<HelpStatus, string> = {
  open: "অপেক্ষমাণ",
  answered: "উত্তর দেওয়া হয়েছে",
  closed: "বন্ধ করা হয়েছে",
};

export interface HelpScholar {
  name: string;
  category: string;
}

export interface PublicHelpView {
  status: HelpStatus;
  question: string;
  details: string | null;
  createdAt: string;
  answer: string | null;
  answeredBy: HelpScholar | null;
  answeredAt: string | null;
  sources: AnswerSource[];
  masalaPath: string | null;
  closedReason: HelpCloseReason | null;
  closedNote: string | null;
  closedAt: string | null;
}

export interface HelpStatusItem {
  token: string;
  found: boolean;
  status: HelpStatus | null;
  updatedAt: string | null;
}

export interface HelpClaimView {
  id: string;
  name: string;
  category: string;
  mine: boolean;
  at: string;
  expiresAt: string;
}

export interface HelpSummary {
  id: string;
  question: string;
  status: HelpStatus;
  claim: HelpClaimView | null;
  requesterName: string | null;
  email: string | null;
  hasContext: boolean;
  createdAt: string;
  answeredAt: string | null;
  answeredBy: HelpScholar | null;
  closedReason: HelpCloseReason | null;
}

export type HelpStats = Record<Exclude<HelpFilter, "all">, number>;

export interface HelpViewer {
  canHandle: boolean;
  isAdmin: boolean;
}

export interface HelpListResponse {
  items: HelpSummary[];
  total: number;
  nextCursor: string | null;
  stats: HelpStats;
  viewer: HelpViewer;
}

export interface HelpContextSource {
  sourceType: SourceType;
  reference: string;
}

export interface HelpNotification {
  sent: boolean;
  at: string;
  error: string | null;
}

export interface HelpPermissions {
  claim: boolean;
  release: boolean;
  answer: boolean;
  close: boolean;
  reopen: boolean;
  reassign: boolean;
  delete: boolean;
}

export interface HelpDetail extends HelpSummary {
  details: string | null;
  context: {
    aiAnswer: string | null;
    references: string[];
    sources: AnswerSource[];
    resolved: HelpContextSource[];
  };
  answer: string | null;
  sources: AnswerSource[];
  masalaId: string | null;
  masalaPath: string | null;
  published: boolean;
  closedNote: string | null;
  closedAt: string | null;
  closedBy: string | null;
  notification: HelpNotification | null;
  updatedAt: string | null;
  expiresAt: string | null;
  can: HelpPermissions;
  viewer: HelpViewer;
}

export interface HelpActionResponse {
  detail: HelpDetail;
  warning: string | null;
}

export interface HelpAssignee {
  id: string;
  name: string;
  category: string;
}
