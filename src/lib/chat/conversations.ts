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

export function compactMessage(message: UsulUIMessage): UsulUIMessage {
  const text = messageText(message);
  const parts: UsulUIMessage["parts"] = [];

  for (const part of message.parts) {
    if (part.type !== "data-sources") continue;
    parts.push({
      type: "data-sources",
      data: part.data.map(({ index, sourceType, reference, page, similarity }) => ({
        index,
        sourceType,
        reference,
        ...(page === undefined ? {} : { page }),
        similarity,
      })),
    });
  }
  if (text.length > 0) parts.push({ type: "text", text });

  return { id: message.id, role: message.role, parts };
}

export function compactMessages(messages: UsulUIMessage[]): UsulUIMessage[] {
  const fullFrom = Math.max(0, messages.length - CHAT_HISTORY_CONFIG.maxMessagesPerConversation);
  const compactFrom = Math.max(0, fullFrom - CHAT_HISTORY_CONFIG.maxCompactMessages);

  return [
    ...messages.slice(compactFrom, fullFrom).map(compactMessage),
    ...messages.slice(fullFrom),
  ];
}

export function upsertConversation(
  list: Conversation[],
  conversation: Conversation,
): Conversation[] {
  const trimmed: Conversation = {
    ...conversation,
    messages: compactMessages(conversation.messages),
  };

  return [trimmed, ...list.filter((item) => item.id !== conversation.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, CHAT_HISTORY_CONFIG.maxConversations);
}

export function dropExpired(
  list: Conversation[],
  now: number = Date.now(),
  maxAgeMs: number = CHAT_HISTORY_CONFIG.maxAgeMs,
): Conversation[] {
  const kept = list.filter((item) => now - item.updatedAt <= maxAgeMs);
  return kept.length === list.length ? list : kept;
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

function removeOutdatedKeys(storage: Storage): void {
  const outdated: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      key?.startsWith(CHAT_HISTORY_CONFIG.storageKeyPrefix) &&
      key !== CHAT_HISTORY_CONFIG.storageKey
    ) {
      outdated.push(key);
    }
  }
  for (const key of outdated) storage.removeItem(key);
}

export function loadConversations(now: number = Date.now()): Conversation[] {
  try {
    const storage = window.localStorage;
    removeOutdatedKeys(storage);

    const raw = storage.getItem(CHAT_HISTORY_CONFIG.storageKey);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      storage.removeItem(CHAT_HISTORY_CONFIG.storageKey);
      return [];
    }

    const valid = parsed.filter(isConversation);
    const current = dropExpired(valid, now);
    if (current.length !== parsed.length) persist(storage, current);
    return current;
  } catch {
    try {
      window.localStorage.removeItem(CHAT_HISTORY_CONFIG.storageKey);
    } catch {
      return [];
    }
    return [];
  }
}

function persist(storage: Storage, list: Conversation[]): void {
  if (list.length === 0) storage.removeItem(CHAT_HISTORY_CONFIG.storageKey);
  else storage.setItem(CHAT_HISTORY_CONFIG.storageKey, JSON.stringify(list));
}

export function saveConversations(list: Conversation[], now: number = Date.now()): Conversation[] {
  const fitted = fitToBudget(dropExpired(list, now), CHAT_HISTORY_CONFIG.maxStorageBytes);
  try {
    persist(window.localStorage, fitted);
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
