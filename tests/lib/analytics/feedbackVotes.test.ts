import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn(() => Promise.reject(new Error("no db"))) }));

const { responseDigest, voteId } = await import("@/lib/analytics/feedbackVotes");
const { answerKey, pruneVotes } = await import("@/lib/chat/feedbackStore");

describe("one feedback per response", () => {
  it("identifies a response by its question and answer, ignoring question punctuation and case", () => {
    const answer = "রোজা অবস্থায় মিসওয়াক করা যায় [1]।";
    expect(responseDigest("রোজা রেখে মিসওয়াক করা যাবে?", answer)).toBe(
      responseDigest("  রোজা রেখে মিসওয়াক করা যাবে ", answer),
    );
    expect(responseDigest("রোজা রেখে মিসওয়াক করা যাবে?", answer)).not.toBe(
      responseDigest("রোজা রেখে মিসওয়াক করা যাবে?", `${answer} আরও ব্যাখ্যা`),
    );
  });

  it("gives each client its own vote on the same response", () => {
    const first = voteId("client-a", "প্রশ্ন", "উত্তর");
    expect(voteId("client-a", "প্রশ্ন", "উত্তর")).toBe(first);
    expect(voteId("client-b", "প্রশ্ন", "উত্তর")).not.toBe(first);
    expect(first).toHaveLength(32);
  });

  it("keys stored browser votes per answer and forgets expired or excess ones", () => {
    expect(answerKey("প্রশ্ন", "উত্তর")).toBe(answerKey("প্রশ্ন ", " উত্তর"));
    expect(answerKey("প্রশ্ন", "উত্তর ১")).not.toBe(answerKey("প্রশ্ন", "উত্তর ২"));

    const now = Date.UTC(2026, 8, 15);
    const kept = pruneVotes(
      {
        fresh: { verdict: "helpful", at: now - 1_000 },
        old: { verdict: "unhelpful", at: now - 400 * 86_400_000 },
        broken: { verdict: "maybe" as never, at: now },
      },
      now,
    );
    expect(Object.keys(kept)).toEqual(["fresh"]);
  });
});
