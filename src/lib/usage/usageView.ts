import { USAGE_CONFIG } from "@/config/site";
import type { Conversation } from "@/lib/chat/conversations";
import type { UsulUIMessage } from "@/types";

export type UsageLevel = "normal" | "warning" | "critical";

export function usageRatio(used: number, limit: number): number {
  if (limit <= 0) return 1;
  return Math.min(1, Math.max(0, used / limit));
}

export function usageLevel(used: number, limit: number): UsageLevel {
  const ratio = usageRatio(used, limit);
  if (ratio >= USAGE_CONFIG.criticalRatio) return "critical";
  if (ratio >= USAGE_CONFIG.warnRatio) return "warning";
  return "normal";
}

const numberFormat = new Intl.NumberFormat("bn-BD");

export function bn(value: number): string {
  return numberFormat.format(value);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return hours > 0 ? `${bn(days)} দিন ${bn(hours)} ঘণ্টা` : `${bn(days)} দিন`;
  if (hours > 0)
    return minutes > 0 ? `${bn(hours)} ঘণ্টা ${bn(minutes)} মিনিট` : `${bn(hours)} ঘণ্টা`;
  if (minutes > 0)
    return seconds > 0 ? `${bn(minutes)} মিনিট ${bn(seconds)} সেকেন্ড` : `${bn(minutes)} মিনিট`;
  return `${bn(seconds)} সেকেন্ড`;
}

export interface LocalUsage {
  conversations: number;
  messages: number;
  questions: number;
}

export function localUsage(
  conversations: readonly Conversation[],
  messages: readonly UsulUIMessage[],
): LocalUsage {
  return {
    conversations: conversations.length,
    messages: messages.length,
    questions: messages.filter((message) => message.role === "user").length,
  };
}

export function isUsageCommand(text: string): boolean {
  return text.trim().toLowerCase() === USAGE_CONFIG.command;
}

export function remainingToday(usage: { day: WindowUsageLike }): number {
  return Math.max(0, usage.day.limit - usage.day.used);
}

interface WindowUsageLike {
  used: number;
  limit: number;
}
