import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn(() => Promise.reject(new Error("no db"))) }));

const { topicKey } = await import("@/lib/learning/topicKey");
const { classifyFollowUp, previousExchange } = await import("@/lib/learning/implicitFeedback");
const { preferReliable, successRatio } = await import("@/lib/learning/modelStats");
const { isTrusted, tallyKey, tallyUpdate } = await import("@/lib/analytics/feedback");
const { netSignal } = await import("@/lib/analytics/rankingSignals");
const { createLru } = await import("@/lib/utils/lru");

import type { UsulUIMessage } from "@/types";

describe("topicKey", () => {
  it("gives the same key to the same question asked in a different order or with filler", () => {
    expect(topicKey("সফরে কসর নামাজ কত দিন পড়া যাবে?")).toBe(
      topicKey("কত দিন সফরে কসর নামাজ পড়া যাবে"),
    );
    expect(topicKey("নামাজ পড়া যাবে")).not.toBe(topicKey("নামাজ পড়া যাবে না"));
  });
});

describe("classifyFollowUp", () => {
  it("hears a complaint about the previous answer in Bangla, Banglish and English", () => {
    for (const message of [
      "ভুল",
      "আপনার দেওয়া দলিল ভুল",
      "uttor ta vul hoise",
      "reference thik na",
      "This answer is wrong",
      "হাদিসটা প্রাসঙ্গিক নয়",
    ]) {
      expect(classifyFollowUp(message), message).toBe("complaint");
    }
  });

  it("does not mistake a question about mistakes for a complaint", () => {
    expect(classifyFollowUp("নামাজে ভুল হলে কী করতে হবে?")).toBeNull();
    expect(classifyFollowUp("namaje vul hole sahu sijda kivabe dibo")).toBeNull();
    expect(classifyFollowUp("What should I do if I make a mistake in wudu and pray?")).toBeNull();
  });

  it("hears thanks as a weak positive", () => {
    expect(classifyFollowUp("জাযাকাল্লাহ, বুঝেছি")).toBe("thanks");
    expect(classifyFollowUp("Thanks, that was helpful")).toBe("thanks");
    expect(
      classifyFollowUp("ধন্যবাদ, এখন বলুন যাকাতের নিসাব কত এবং কবে দিতে হয় আর কাকে দিতে হয়"),
    ).toBeNull();
  });
});

describe("previousExchange", () => {
  const message = (role: "user" | "assistant", text: string, references: string[] = []) =>
    ({
      id: `${role}-${text.length}`,
      role,
      parts: [
        ...(references.length > 0
          ? [
              {
                type: "data-sources",
                data: references.map((reference, index) => ({
                  index: index + 1,
                  sourceType: "quran",
                  reference,
                })),
              },
            ]
          : []),
        { type: "text", text },
      ],
    }) as unknown as UsulUIMessage;

  it("finds the question, answer and sources the follow-up refers to", () => {
    const exchange = previousExchange([
      message("user", "হিজাব কি ফরজ?"),
      message("assistant", "হ্যাঁ, ফরজ [1]।", ["Al-Ahzaab 33:59"]),
      message("user", "ভুল"),
    ]);

    expect(exchange?.question).toBe("হিজাব কি ফরজ?");
    expect(exchange?.sources.map((source) => source.reference)).toEqual(["Al-Ahzaab 33:59"]);
    expect(exchange?.followUp).toBe("ভুল");
  });

  it("returns nothing for a first message", () => {
    expect(previousExchange([message("user", "ভুল")])).toBeNull();
  });
});

describe("learning weights", () => {
  it("counts implicit signals at half weight", () => {
    expect(netSignal({ positive: 1, negative: 0, implicitNegative: 2 })).toBe(0);
    expect(netSignal({ positive: 0, negative: 0, implicitPositive: 1 })).toBe(0.5);
  });

  it("needs distinct people and no complaint before an answer is verified automatically", () => {
    expect(isTrusted({ supporters: ["a"] })).toBe(false);
    expect(isTrusted({ supporters: ["a", "b", "c"] })).toBe(true);
    expect(isTrusted({ supporters: ["a", "b", "c"], unhelpful: 1 })).toBe(false);
    expect(isTrusted({ supporters: ["a", "b", "c"], wrongCitation: 1 })).toBe(false);
  });

  it("tallies the same question asked in another order under one key", () => {
    expect(tallyKey("সফরে কসর নামাজ কত দিন পড়া যাবে?")).toBe(
      tallyKey("কত দিন সফরে কসর নামাজ পড়া যাবে"),
    );
    expect(tallyKey("নামাজ পড়া যাবে")).not.toBe(tallyKey("নামাজ পড়া যাবে না"));
  });

  it("counts a vote without storing the question, answer or note", () => {
    const helpful = JSON.stringify(
      tallyUpdate(
        { verdict: "helpful", question: "যাকাতের নিসাব কত?", origin: "explicit", supporter: "a" },
        new Date(0),
      ),
    );
    const implicit = JSON.stringify(
      tallyUpdate(
        { verdict: "unhelpful", question: "যাকাতের নিসাব কত?", origin: "implicit", supporter: "b" },
        new Date(0),
      ),
    );

    expect(helpful).toContain('"$literal":["a"]');
    expect(helpful).not.toContain("যাকাতের নিসাব কত?");
    expect(implicit).not.toContain('"$literal"');
    expect(implicit).toContain('"$unhelpful",0]},1]');
  });

  it("moves models whose answers keep failing the gate to the end, once there is enough evidence", () => {
    const chain = [{ modelId: "weak" }, { modelId: "strong" }, { modelId: "new" }];
    const stats = new Map([
      ["weak", { answered: 1, rejected: 9 }],
      ["strong", { answered: 9, rejected: 1 }],
      ["new", { answered: 0, rejected: 2 }],
    ]);

    expect(successRatio(stats.get("new"))).toBeNull();
    expect(preferReliable(chain, stats).map((entry) => entry.modelId)).toEqual([
      "strong",
      "new",
      "weak",
    ]);
  });

  it("forgets cached entries by topic", () => {
    const cache = createLru<{ topic: string }>(10);
    cache.set("a", { topic: "hijab" });
    cache.set("b", { topic: "zakat" });
    expect(cache.deleteWhere((entry) => entry.topic === "hijab")).toBe(1);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toEqual({ topic: "zakat" });
  });
});
