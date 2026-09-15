import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn(() => Promise.reject(new Error("no db"))) }));

const { REVIEW_CONFIG } = await import("@/config/site");
const { AdminError } = await import("@/lib/admin/errors");
const queue = await import("@/lib/reviews/queue");

import type { AnswerSource } from "@/types";

const id = new ObjectId("66e6a1b2c3d4e5f60718293a");
const now = new Date("2026-09-15T10:00:00Z");

const scholar = {
  principalId: "staff-1",
  name: "করিম",
  categoryName: "মুফতি",
  email: "karim@example.com",
  role: "scholar" as const,
};

const source: AnswerSource = {
  index: 1,
  sourceType: "quran",
  reference: "Al-Baqara 2:255",
  url: "https://quran.com/2/255",
  media: "web",
  similarity: 0.83,
};

describe("reviewKey", () => {
  it("merges repeats of the same question and answer despite punctuation and spacing", () => {
    expect(queue.reviewKey("যাকাত কাদের উপর ফরজ?", "উত্তর  এখানে\n")).toBe(
      queue.reviewKey("  যাকাত কাদের উপর ফরজ ", "উত্তর এখানে"),
    );
  });

  it("keeps different answers to one question apart", () => {
    expect(queue.reviewKey("প্রশ্ন", "প্রথম উত্তর")).not.toBe(
      queue.reviewKey("প্রশ্ন", "অন্য উত্তর"),
    );
  });
});

describe("enqueueUpdate", () => {
  it("counts the verdict, keeps only the last notes and caps stored text", () => {
    const update = queue.enqueueUpdate(
      {
        verdict: "wrong-citation",
        question: "q".repeat(REVIEW_CONFIG.maxQuestionChars + 50),
        answer: "a".repeat(REVIEW_CONFIG.maxAnswerChars + 50),
        sources: [source],
        note: ` ${"n".repeat(REVIEW_CONFIG.maxNoteChars + 10)} `,
        origin: "implicit",
      },
      now,
    ) as Record<string, Record<string, unknown>>;

    expect(update.$inc).toEqual({ count: 1, wrongCitation: 1, implicit: 1 });
    expect(update.$set).toEqual({ lastFlaggedAt: now });
    const inserted = update.$setOnInsert as Record<string, unknown>;
    expect(inserted.status).toBe("open");
    expect((inserted.question as string).length).toBe(REVIEW_CONFIG.maxQuestionChars);
    expect((inserted.answer as string).length).toBe(REVIEW_CONFIG.maxAnswerChars);
    expect(inserted.createdAt).toBe(now);
    const push = update.$push?.notes as { $each: { text: string }[]; $slice: number };
    expect(push.$slice).toBe(-queue.REVIEW_MAX_NOTES);
    expect(push.$each[0]?.text.length).toBe(REVIEW_CONFIG.maxNoteChars);
  });

  it("does not push an empty note", () => {
    const update = queue.enqueueUpdate(
      {
        verdict: "unhelpful",
        question: "q",
        answer: "a",
        sources: [],
        note: "  ",
        origin: "explicit",
      },
      now,
    ) as Record<string, unknown>;
    expect(update.$push).toBeUndefined();
    expect(update.$inc).toEqual({ count: 1, unhelpful: 1 });
  });
});

describe("compactReviewSources", () => {
  it("drops links and scores but keeps what the source viewer needs", () => {
    expect(queue.compactReviewSources([{ ...source, page: 4, grade: "সহীহ" }])).toEqual([
      {
        index: 1,
        sourceType: "quran",
        reference: "Al-Baqara 2:255",
        page: 4,
        grade: "সহীহ",
        similarity: 0,
      },
    ]);
  });
});

describe("queue filters", () => {
  it("separates unclaimed, claimed and my claims by expiry", () => {
    expect(queue.statusFilter("unclaimed", "staff-1", now)).toEqual({
      status: "open",
      $or: [{ claim: null }, { "claim.expiresAt": { $lte: now } }],
    });
    expect(queue.statusFilter("mine", "staff-1", now)).toEqual({
      status: "open",
      "claim.by": "staff-1",
      "claim.expiresAt": { $gt: now },
    });
    expect(queue.verdictFilter("implicit")).toEqual({ implicit: { $gt: 0 } });
  });

  it("round-trips both cursor shapes and rejects bad ones", () => {
    const row = { _id: id, count: 7, lastFlaggedAt: now };
    const flagged = queue.parseReviewCursor("flagged", queue.encodeReviewCursor("flagged", row));
    expect(flagged.count).toBe(7);
    expect(flagged.at.getTime()).toBe(now.getTime());
    expect(flagged.id.equals(id)).toBe(true);

    const newest = queue.parseReviewCursor("newest", queue.encodeReviewCursor("newest", row));
    expect(newest.at.getTime()).toBe(now.getTime());
    expect(queue.reviewsAfter("newest", newest)).toEqual({
      $or: [{ lastFlaggedAt: { $lt: now } }, { lastFlaggedAt: now, _id: { $lt: id } }],
    });

    for (const value of ["", "abc", `1.${id.toHexString()}`]) {
      expect(() => queue.parseReviewCursor("flagged", value)).toThrow(AdminError);
    }
  });
});

describe("claims", () => {
  it("lets a scholar take only a free, expired or own claim, and an admin any", () => {
    expect(queue.claimableFilter(id, scholar, now)).toEqual({
      _id: id,
      $or: [{ claim: null }, { "claim.expiresAt": { $lte: now } }, { "claim.by": "staff-1" }],
    });
    expect(queue.claimableFilter(id, { ...scholar, role: "admin" }, now)).toEqual({ _id: id });
  });

  it("expires a claim after the configured minutes", () => {
    const claim = queue.newClaim(scholar, now);
    expect(claim.expiresAt.getTime() - now.getTime()).toBe(REVIEW_CONFIG.claimMinutes * 60_000);
    expect(queue.activeClaim(claim, now)).toBe(claim);
    expect(queue.activeClaim(claim, claim.expiresAt)).toBeNull();
  });

  it("shows notes newest first and marks my claim in the detail view", () => {
    const detail = queue.toReviewDetail(
      {
        _id: id,
        key: "k",
        status: "open",
        question: "প্রশ্ন",
        answer: "উত্তর",
        sources: [source],
        topic: "প্রশ্ন",
        count: 2,
        unhelpful: 2,
        notes: [
          { text: "প্রথম", verdict: "unhelpful", origin: "explicit", at: now },
          { text: "দ্বিতীয়", verdict: "unhelpful", origin: "explicit", at: now },
        ],
        claim: queue.newClaim(scholar, now),
        createdAt: now,
        lastFlaggedAt: now,
      },
      "staff-1",
      now,
    );
    expect(detail.notes.map((note) => note.text)).toEqual(["দ্বিতীয়", "প্রথম"]);
    expect(detail.claim?.mine).toBe(true);
    expect(detail.wrongCitation).toBe(0);
    expect(detail.noteCount).toBe(2);
  });
});

describe("enqueueReview", () => {
  it("never throws when the database is unavailable", async () => {
    await expect(
      queue.enqueueReview({
        verdict: "unhelpful",
        question: "প্রশ্ন",
        answer: "উত্তর",
        sources: [],
        origin: "explicit",
      }),
    ).resolves.toBeUndefined();
  });
});
