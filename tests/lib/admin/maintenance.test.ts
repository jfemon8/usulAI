import { describe, expect, it } from "vitest";
import { AdminError } from "@/lib/admin/http";
import {
  forgetTopicSchema,
  groupRateLimits,
  maskClient,
  modelHealthRows,
  recentTopics,
  resolveTopic,
  unblockSchema,
} from "@/lib/admin/maintenance";
import { windowIndex } from "@/lib/security/rateLimit";

const now = Date.parse("2026-09-15T08:30:10Z");
const hash = "e4eb527ee7ec592052eb16ee";

function counter(window: "minute" | "hour" | "day", c: number, offset = 0) {
  return { w: windowIndex(now, window) - offset, c };
}

describe("rate limit grouping", () => {
  it("counts only current windows, masks clients and flags blocked ones", () => {
    const scopes = groupRateLimits(
      [
        {
          _id: `chat:${hash}`,
          minute: counter("minute", 9),
          hour: counter("hour", 12),
          day: counter("day", 40),
        },
        {
          _id: "chat:aaaaaaaaaaaaaaaaaaaaaaaa",
          minute: counter("minute", 3, 1),
          hour: counter("hour", 3),
          day: counter("day", 3),
        },
        { _id: "chat:global", day: counter("day", 300) },
        { _id: "sourceView:bbbbbbbbbbbbbbbbbbbbbbbb", day: counter("day", 5, 1) },
        { _id: "bad id", day: counter("day", 99) },
      ],
      now,
    );

    expect(scopes).toHaveLength(1);
    const [chat] = scopes;
    expect(chat?.scope).toBe("chat");
    expect(chat?.limits).toEqual({ minute: 5, hour: 30, day: 100 });
    expect(chat?.clients.map((client) => client.id)).toEqual([
      "chat:global",
      `chat:${hash}`,
      "chat:aaaaaaaaaaaaaaaaaaaaaaaa",
    ]);
    expect(chat?.clients[0]).toMatchObject({ shared: true, blocked: false, client: "সবার মোট" });
    expect(chat?.clients[1]).toMatchObject({
      client: "e4eb52••••ee",
      minute: 9,
      hour: 12,
      day: 40,
      blocked: true,
    });
    expect(chat?.clients[2]).toMatchObject({ minute: 0, blocked: false });
  });

  it("limits clients per scope", () => {
    const docs = Array.from({ length: 15 }, (_, index) => ({
      _id: `usage:${index.toString(16).padStart(24, "0")}`,
      day: counter("day", index + 1),
    }));
    const [usage] = groupRateLimits(docs, now, 10);
    expect(usage?.clients).toHaveLength(10);
    expect(usage?.clients[0]?.day).toBe(15);
  });

  it("validates ids before unblocking", () => {
    expect(unblockSchema.safeParse({ id: `chat:${hash}` }).success).toBe(true);
    expect(unblockSchema.safeParse({ id: "chat:global" }).success).toBe(true);
    for (const id of ["chat", `chat:${hash}x`, "chat:*", `$where:${hash}`, `chat:${hash}:x`]) {
      expect(unblockSchema.safeParse({ id }).success).toBe(false);
    }
    expect(maskClient(hash)).toBe("e4eb52••••ee");
  });
});

describe("learned memory", () => {
  it("resolves a topic from a question regardless of word order", () => {
    expect(resolveTopic({ question: "সফরে কসর নামাজ কত দিন পড়া যাবে?" })).toBe(
      resolveTopic({ question: "কত দিন সফরে কসর নামাজ পড়া যাবে" }),
    );
    expect(resolveTopic({ topic: " কসর নামাজ ", question: "ignored" })).toBe("কসর নামাজ");
  });

  it("refuses an empty topic", () => {
    expect(() => resolveTopic({ question: "?" })).toThrow(AdminError);
    expect(forgetTopicSchema.safeParse({}).success).toBe(false);
    expect(forgetTopicSchema.safeParse({ question: "যাকাত" }).success).toBe(true);
  });

  it("merges recent topics across kinds and caps the list", () => {
    const at = (minutes: number) => new Date(now - minutes * 60_000);
    const topics = recentTopics(
      [
        { topic: "a", kind: "rewrite", lastUsedAt: at(1) },
        { topic: "b", kind: "verdict", lastUsedAt: at(2) },
        { topic: "a", kind: "verdict", lastUsedAt: at(3) },
        { kind: "verdict", lastUsedAt: at(4) },
        { topic: "c", kind: "verdict", lastUsedAt: at(5) },
      ],
      2,
    );
    expect(topics).toEqual([
      { topic: "a", kinds: ["rewrite", "verdict"], lastUsedAt: at(1).toISOString() },
      { topic: "b", kinds: ["verdict"], lastUsedAt: at(2).toISOString() },
    ]);
  });
});

describe("model health", () => {
  it("combines the chain, cooldowns and stored answer stats", () => {
    const stored = (topic: string, value: { answered?: number; rejected?: number }) => ({
      _id: `model:${topic}`,
      kind: "model" as const,
      topic,
      value,
      updatedAt: new Date(now),
      lastUsedAt: new Date(now),
    });
    const rows = modelHealthRows(
      [
        { modelId: "gemini", tier: "primary", provider: "google", keyConfigured: false },
        { modelId: "qwen", tier: "secondary", provider: "groq", keyConfigured: true },
      ],
      [stored("qwen", { answered: 1, rejected: 9 }), stored("retired", { answered: 3 })],
      { disabled: ["gemini"], cooling: (modelId) => modelId === "qwen" },
    );

    expect(rows.map((row) => row.modelId)).toEqual(["gemini", "qwen", "retired"]);
    expect(rows[0]).toMatchObject({ disabled: true, coolingDown: false, successRatio: null });
    expect(rows[1]).toMatchObject({
      coolingDown: true,
      answered: 1,
      rejected: 9,
      successRatio: 0.1,
      demoted: true,
    });
    expect(rows[2]).toMatchObject({ inChain: false, tier: null, successRatio: null });
  });
});
