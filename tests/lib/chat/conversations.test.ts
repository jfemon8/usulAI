import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_HISTORY_CONFIG } from "@/config/site";
import {
  compactMessage,
  compactMessages,
  deriveTitle,
  dropExpired,
  fitToBudget,
  loadConversations,
  saveConversations,
  upsertConversation,
  type Conversation,
} from "@/lib/chat/conversations";
import type { UsulUIMessage } from "@/types";

function user(text: string): UsulUIMessage {
  return { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] };
}

function conversation(id: string, updatedAt: number, messages: UsulUIMessage[] = []): Conversation {
  return { id, title: id, updatedAt, messages };
}

describe("deriveTitle", () => {
  it("uses the first question, collapsed and shortened", () => {
    const long =
      "যাকাত   কাদের উপর ফরজ এবং নিসাবের পরিমাণ কত, আর কখন আদায় করতে হয় বিস্তারিত বলুন";
    const title = deriveTitle([user(long)]);

    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(CHAT_HISTORY_CONFIG.titleChars + 1);
    expect(title).not.toContain("  ");
  });

  it("names an empty conversation", () => {
    expect(deriveTitle([])).toBe("নতুন কথোপকথন");
  });
});

describe("upsertConversation", () => {
  it("moves the updated conversation to the top without duplicating it", () => {
    const list = [conversation("a", 3), conversation("b", 2)];
    const result = upsertConversation(list, conversation("b", 5));

    expect(result.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("keeps only the newest conversations", () => {
    const many = Array.from({ length: CHAT_HISTORY_CONFIG.maxConversations + 5 }, (_, index) =>
      conversation(`c${index}`, index),
    );
    const result = many.reduce<Conversation[]>((list, item) => upsertConversation(list, item), []);

    expect(result).toHaveLength(CHAT_HISTORY_CONFIG.maxConversations);
    expect(result[0]?.id).toBe(`c${CHAT_HISTORY_CONFIG.maxConversations + 4}`);
  });
});

describe("compactMessages", () => {
  function answer(index: number): UsulUIMessage {
    return {
      id: `a${index}`,
      role: "assistant",
      parts: [
        {
          type: "data-sources",
          data: [
            {
              index: 1,
              sourceType: "quran",
              reference: "Al-Baqara 2:255",
              url: "https://quran.com/2/255",
              page: 4,
              similarity: 0.9,
              grade: "সহীহ",
            },
          ],
        },
        { type: "step-start" },
        { type: "text", text: `উত্তর ${index}`, state: "done" },
        { type: "data-outcome", data: { retryable: false } },
      ],
    };
  }

  const full = CHAT_HISTORY_CONFIG.maxMessagesPerConversation;
  const compact = CHAT_HISTORY_CONFIG.maxCompactMessages;

  it("keeps the latest messages whole and the older ones with their text and references", () => {
    const messages = Array.from({ length: full + 3 }, (_, index) => answer(index));
    const result = compactMessages(messages);

    expect(result).toHaveLength(full + 3);
    expect(result.slice(3)).toEqual(messages.slice(3));
    expect(result[0]).toEqual({
      id: "a0",
      role: "assistant",
      parts: [
        {
          type: "data-sources",
          data: [
            {
              index: 1,
              sourceType: "quran",
              reference: "Al-Baqara 2:255",
              page: 4,
              similarity: 0.9,
            },
          ],
        },
        { type: "text", text: "উত্তর 0" },
      ],
    });
  });

  it("is stable when a compacted conversation is saved again", () => {
    const once = compactMessages(Array.from({ length: full + 10 }, (_, index) => answer(index)));

    expect(compactMessages(once)).toEqual(once);
    expect(compactMessage(once[0]!)).toEqual(once[0]);
  });

  it("bounds how many compact messages are kept", () => {
    const messages = Array.from({ length: full + compact + 7 }, (_, index) => answer(index));
    const result = compactMessages(messages);

    expect(result).toHaveLength(full + compact);
    expect(result[0]?.id).toBe("a7");
  });

  it("stores the conversation through upsert in compact form", () => {
    const messages = Array.from({ length: full + 1 }, (_, index) => answer(index));
    const [stored] = upsertConversation([], conversation("c", 1, messages));

    expect(stored?.messages).toHaveLength(full + 1);
    expect(stored?.messages[0]?.parts).toHaveLength(2);
  });
});

describe("fitToBudget", () => {
  it("drops the oldest conversations until the list fits", () => {
    const heavy = (id: string, at: number) => conversation(id, at, [user("ক".repeat(2000))]);
    const list = [heavy("new", 3), heavy("mid", 2), heavy("old", 1)];
    const oneSize = new Blob([JSON.stringify([list[0]])]).size;

    const fitted = fitToBudget(list, oneSize * 2 + 10);

    expect(fitted.map((item) => item.id)).toEqual(["new", "mid"]);
  });
});

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

describe("automatic expiry of stored conversations", () => {
  const now = Date.UTC(2027, 8, 15);
  const day = 24 * 60 * 60 * 1000;
  const fresh = conversation("fresh", now - 30 * day, [user("নামাজ")]);
  const almostYear = conversation("almost", now - 364 * day, [user("রোজা")]);
  const old = conversation("old", now - 366 * day, [user("যাকাত")]);
  let storage: Storage;

  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drops conversations not touched for more than a year", () => {
    expect(dropExpired([fresh, almostYear, old], now).map((item) => item.id)).toEqual([
      "fresh",
      "almost",
    ]);
    const untouched = [fresh];
    expect(dropExpired(untouched, now)).toBe(untouched);
  });

  it("removes expired conversations from localStorage when the app loads", () => {
    storage.setItem(CHAT_HISTORY_CONFIG.storageKey, JSON.stringify([fresh, old]));

    expect(loadConversations(now).map((item) => item.id)).toEqual(["fresh"]);
    expect(JSON.parse(storage.getItem(CHAT_HISTORY_CONFIG.storageKey)!)).toHaveLength(1);
  });

  it("deletes the key entirely once everything has expired", () => {
    storage.setItem(CHAT_HISTORY_CONFIG.storageKey, JSON.stringify([old]));

    expect(loadConversations(now)).toEqual([]);
    expect(storage.getItem(CHAT_HISTORY_CONFIG.storageKey)).toBeNull();
  });

  it("never writes expired conversations back when saving", () => {
    expect(saveConversations([fresh, old], now).map((item) => item.id)).toEqual(["fresh"]);
    expect(storage.getItem(CHAT_HISTORY_CONFIG.storageKey)).toContain("fresh");
    expect(storage.getItem(CHAT_HISTORY_CONFIG.storageKey)).not.toContain('"old"');
  });

  it("clears unreadable data and storage keys left by older versions", () => {
    storage.setItem(`${CHAT_HISTORY_CONFIG.storageKeyPrefix}v0`, "[]");
    storage.setItem("unrelated-key", "keep");
    storage.setItem(CHAT_HISTORY_CONFIG.storageKey, "{not json");

    expect(loadConversations(now)).toEqual([]);
    expect(storage.getItem(CHAT_HISTORY_CONFIG.storageKey)).toBeNull();
    expect(storage.getItem(`${CHAT_HISTORY_CONFIG.storageKeyPrefix}v0`)).toBeNull();
    expect(storage.getItem("unrelated-key")).toBe("keep");
  });
});
