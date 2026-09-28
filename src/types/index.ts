import type { UIMessage } from "ai";
import type { SOURCE_PRIORITY } from "@/config/site";

export type SourceType = (typeof SOURCE_PRIORITY)[number];

export type CitationMedia = "web" | "image" | "pdf";

export interface SourceCitation {
  sourceType: SourceType;
  reference: string;
  url?: string;
  media?: CitationMedia;
  page?: number;
  pageCount?: number;
}

export interface HadithGrade {
  name: string;
  grade: string;
}

export interface TranslatedSegment {
  arabic: string;
  vocalized?: string;
  bangla: string;
  english: string;
}

export interface RetrievedChunk {
  id: string;
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  similarity: number;
  retrievedBy: "vector" | "text" | "history";
  grades?: HadithGrade[];
  note?: string;
  vocalized?: string;
  machineTranslated?: boolean;
  segments?: TranslatedSegment[];
}

export interface IngestionDocument {
  sourceType: SourceType;
  content: string;
  citation: SourceCitation;
  metadata?: Record<string, unknown>;
  provenance?: string;
}

export interface AnswerSource {
  index: number;
  sourceType: SourceType;
  reference: string;
  url?: string;
  media?: CitationMedia;
  page?: number;
  pageCount?: number;
  similarity: number;
  grade?: string;
}

export interface AnswerOutcome {
  retryable: boolean;
}

export interface VerifiedInfo {
  authorName: string;
  authorCategory: string;
  path: string | null;
}

export type GeneralIntent =
  | "salam"
  | "salamReply"
  | "greeting"
  | "wellbeing"
  | "identity"
  | "capabilities"
  | "creator"
  | "thanks"
  | "goodbye"
  | "date"
  | "day"
  | "time"
  | "weather"
  | "prayer"
  | "currentPrayer"
  | "kalima"
  | "salahImportance"
  | "salahFazilat"
  | "rakat"
  | "ramadan"
  | "sawmNiyat"
  | "iftarDua"
  | "sawmFazilat"
  | "hajj"
  | "hajjFazilat"
  | "zakatNisab"
  | "zakatRate"
  | "zakatCalc"
  | "zakatFazilat";

export interface ZakatPrices {
  goldPerGram: number | null;
  silverPerGram: number | null;
  source: string | null;
  updatedAt: string | null;
}

export interface ZakatAssets {
  cash: number;
  business: number;
  receivables: number;
  goldGrams: number;
  goldKarat: number;
  goldValue: number;
  silverGrams: number;
  silverValue: number;
  debts: number;
}

export interface GeneralCardStat {
  label: string;
  value: string;
}

export interface GeneralCardRow {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface GeneralCard {
  kind:
    "date" | "time" | "weather" | "prayer" | "creator" | "prayerNow" | "ramadan" | "hajj" | "zakat";
  lang: "bn" | "en";
  icon?: string;
  eyebrow?: string;
  headline: string;
  headlineHref?: string;
  subline?: string;
  stats?: GeneralCardStat[];
  rows?: GeneralCardRow[];
  note?: string;
  link?: { label: string; href: string };
  timeZone?: string;
  countdown?: { to: number; label: string };
  zakat?: { prices: ZakatPrices; assets: ZakatAssets };
}

export type GeneralBlock = { type: "markdown"; text: string } | { type: "card"; card: GeneralCard };

export interface GeneralInfo {
  intents: GeneralIntent[];
  blocks: GeneralBlock[];
}

export type UsulDataParts = {
  sources: AnswerSource[];
  outcome: AnswerOutcome;
  verified: VerifiedInfo;
  general: GeneralInfo;
};

export type UsulUIMessage = UIMessage<never, UsulDataParts>;
