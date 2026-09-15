import type { USAGE_CONFIG } from "@/config/site";

export interface WindowUsage {
  used: number;
  limit: number;
  resetsAt: number;
}

export interface ScopeUsage {
  minute: WindowUsage;
  hour: WindowUsage;
  day: WindowUsage;
}

export type UsageScope = (typeof USAGE_CONFIG.reportedScopes)[number];

export interface UsageResponse {
  serverTime: number;
  scopes: Record<UsageScope, ScopeUsage>;
  limits: {
    maxQuestionChars: number;
    maxConversations: number;
    maxMessagesPerConversation: number;
    maxCompactMessages: number;
  };
}
