import { CHAT_HISTORY_CONFIG } from "@/config/site";
import type { UsulUIMessage } from "@/types";

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: UsulUIMessage[];
}

export function messageText(message: UsulUIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export function deriveTitle(messages: UsulUIMessage[]): string {
  const first = messages.find((message) => message.role === "user");
  const text = first ? messageText(first).replace(/\s+/g, " ").trim() : "";
  if (text.length === 0) return "নতুন কথোপকথন";
  return text.length > CHAT_HISTORY_CONFIG.titleChars
    ? `${text.slice(0, CHAT_HISTORY_CONFIG.titleChars).trimEnd()}…`
    : text;
}

export function upsertConversation(
  list: Conversation[],
  conversation: Conversation,
): Conversation[] {
  const trimmed: Conversation = {
    ...conversation,
    messages: conversation.messages.slice(-CHAT_HISTORY_CONFIG.maxMessagesPerConversation),
  };

  return [trimmed, ...list.filter((item) => item.id !== conversation.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, CHAT_HISTORY_CONFIG.maxConversations);
}

export function fitToBudget(list: Conversation[], maxBytes: number): Conversation[] {
  const kept = [...list];
  while (kept.length > 1 && new Blob([JSON.stringify(kept)]).size > maxBytes) kept.pop();
  return kept;
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Conversation>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.updatedAt === "number" &&
    Array.isArray(candidate.messages)
  );
}

export function loadConversations(): Conversation[] {
  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_CONFIG.storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isConversation) : [];
  } catch {
    return [];
  }
}

export function saveConversations(list: Conversation[]): Conversation[] {
  const fitted = fitToBudget(list, CHAT_HISTORY_CONFIG.maxStorageBytes);
  try {
    window.localStorage.setItem(CHAT_HISTORY_CONFIG.storageKey, JSON.stringify(fitted));
  } catch {
    return fitted;
  }
  return fitted;
}

const EMPTY: Conversation[] = [];
const listeners = new Set<() => void>();
let snapshot: Conversation[] | null = null;

export const conversationStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): Conversation[] {
    snapshot ??= loadConversations();
    return snapshot;
  },
  getServerSnapshot(): Conversation[] {
    return EMPTY;
  },
  update(change: (current: Conversation[]) => Conversation[]): void {
    const current = conversationStore.getSnapshot();
    const next = change(current);
    if (next === current) return;
    snapshot = saveConversations(next);
    for (const listener of listeners) listener();
  },
};
