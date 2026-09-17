import type { UsulUIMessage } from "../src/types";

export const WIDGET_MESSAGE_SOURCE = "usul-ai-widget-v1";
export const WIDGET_VISIT_KEY = "usul-ai-widget-visit-v1";
export const WIDGET_NAVIGATION_KEY = "usul-ai-widget-navigation-v1";
export const WIDGET_CHAT_KEY = "usul-ai-widget-chat-v1";

export interface WidgetChat {
  id: string;
  messages: UsulUIMessage[];
  pendingJobId?: string;
}

export type WidgetMessage =
  | { source: typeof WIDGET_MESSAGE_SOURCE; type: "ready"; visitId: string }
  | {
      source: typeof WIDGET_MESSAGE_SOURCE;
      type: "restore";
      visitId: string;
      chat: WidgetChat | null;
    }
  | { source: typeof WIDGET_MESSAGE_SOURCE; type: "save"; visitId: string; chat: WidgetChat }
  | {
      source: typeof WIDGET_MESSAGE_SOURCE;
      type: "pending";
      visitId: string;
      chatId: string;
      jobId: string;
      messages: UsulUIMessage[];
    }
  | {
      source: typeof WIDGET_MESSAGE_SOURCE;
      type: "cancel";
      visitId: string;
      chatId: string;
      jobId: string;
    }
  | { source: typeof WIDGET_MESSAGE_SOURCE; type: "clear"; visitId: string };

export function isWidgetChat(value: unknown): value is WidgetChat {
  if (typeof value !== "object" || value === null) return false;
  const chat = value as Partial<WidgetChat>;
  return (
    typeof chat.id === "string" &&
    chat.id.length > 0 &&
    (chat.pendingJobId === undefined || typeof chat.pendingJobId === "string") &&
    Array.isArray(chat.messages) &&
    chat.messages.every(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        typeof message.id === "string" &&
        (message.role === "user" || message.role === "assistant") &&
        Array.isArray(message.parts),
    )
  );
}

export function isWidgetMessage(value: unknown): value is WidgetMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<WidgetMessage>;
  if (message.source !== WIDGET_MESSAGE_SOURCE || typeof message.visitId !== "string") {
    return false;
  }
  if (message.type === "ready" || message.type === "clear") return true;
  if (message.type === "restore") return message.chat === null || isWidgetChat(message.chat);
  if (message.type === "save") return isWidgetChat(message.chat);
  if (message.type === "pending") {
    return (
      typeof message.chatId === "string" &&
      typeof message.jobId === "string" &&
      isWidgetChat({ id: message.chatId, messages: message.messages })
    );
  }
  if (message.type === "cancel") {
    return typeof message.chatId === "string" && typeof message.jobId === "string";
  }
  return false;
}

export function shouldContinueVisit(
  referrer: string,
  currentUrl: string,
  navigationType: string,
  expectedUrl: string | null,
): boolean {
  if (navigationType === "reload") return true;
  try {
    const current = new URL(currentUrl);
    if (referrer && new URL(referrer).origin === current.origin) return true;
    if (expectedUrl && new URL(expectedUrl).href === current.href) return true;
  } catch {
    return false;
  }
  return false;
}
