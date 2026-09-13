import { describe, expect, it } from "vitest";
import { CHAT_HISTORY_CONFIG } from "@/config/site";
import {
  deriveTitle,
  fitToBudget,
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

describe("fitToBudget", () => {
  it("drops the oldest conversations until the list fits", () => {
    const heavy = (id: string, at: number) => conversation(id, at, [user("ক".repeat(2000))]);
    const list = [heavy("new", 3), heavy("mid", 2), heavy("old", 1)];
    const oneSize = new Blob([JSON.stringify([list[0]])]).size;

    const fitted = fitToBudget(list, oneSize * 2 + 10);

    expect(fitted.map((item) => item.id)).toEqual(["new", "mid"]);
  });
});
