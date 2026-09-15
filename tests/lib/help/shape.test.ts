import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { AdminError } from "@/lib/admin/errors";
import {
  afterCursor,
  encodeHelpCursor,
  filterFor,
  helpActionInput,
  helpSubmitInput,
  helpSummary,
  maskEmail,
  parseFilter,
  parseHelpCursor,
  permissionsFor,
  publicHelpView,
  type HelpActor,
  type HelpRequestDoc,
} from "@/lib/help/shape";

const now = new Date("2026-09-15T10:00:00Z");
const later = new Date(now.getTime() + 60_000);
const earlier = new Date(now.getTime() - 60_000);
const id = new ObjectId("66e6a1b2c3d4e5f60718293a");

const scholar: HelpActor = {
  principalId: "scholar-1",
  name: "আব্দুল্লাহ",
  categoryName: "মুফতি",
  email: "mufti@example.com",
  role: "scholar",
  canHandle: true,
};
const otherScholar: HelpActor = { ...scholar, principalId: "scholar-2", name: "ইউসুফ" };
const admin: HelpActor = { ...scholar, principalId: "admin@example.com", role: "admin" };
const moderator: HelpActor = {
  ...scholar,
  principalId: "mod-1",
  role: "moderator",
  canHandle: false,
};

function request(overrides: Partial<HelpRequestDoc> = {}): HelpRequestDoc {
  return {
    _id: id,
    tokenDigest: "digest",
    question: "নামাজে ভুল হলে কী করব?",
    details: "বিস্তারিত",
    name: "করিম",
    email: "karim@example.com",
    context: { aiAnswer: "AI উত্তর", references: ["Al-Baqara 2:255"] },
    clientKey: "client-hash",
    status: "open",
    createdAt: now,
    expiresAt: later,
    ...overrides,
  };
}

describe("help submission input", () => {
  it("accepts an optional empty email and normalises it away", () => {
    const parsed = helpSubmitInput.parse({ question: "প্রশ্ন", email: "", details: "  " });
    expect(parsed.email).toBeUndefined();
    expect(parsed.details).toBeUndefined();
  });

  it("lower-cases a valid email and rejects an invalid one", () => {
    expect(helpSubmitInput.parse({ question: "প্রশ্ন", email: "A@Example.com" }).email).toBe(
      "a@example.com",
    );
    expect(helpSubmitInput.safeParse({ question: "প্রশ্ন", email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("caps references and requires a question", () => {
    const references = Array.from({ length: 21 }, (_, index) => `ref ${index}`);
    expect(helpSubmitInput.safeParse({ question: "প্রশ্ন", context: { references } }).success).toBe(
      false,
    );
    expect(helpSubmitInput.safeParse({ question: "   " }).success).toBe(false);
  });

  it("parses each action and refuses unknown ones", () => {
    expect(helpActionInput.parse({ action: "close", reason: "duplicate" })).toEqual({
      action: "close",
      reason: "duplicate",
    });
    expect(helpActionInput.safeParse({ action: "explode" }).success).toBe(false);
    expect(helpActionInput.safeParse({ action: "close", reason: "because" }).success).toBe(false);
  });
});

describe("maskEmail", () => {
  it("keeps only the first character and the domain", () => {
    expect(maskEmail("abdullah@gmail.com")).toBe("a***@gmail.com");
    expect(maskEmail("broken")).toBe("***");
  });
});

describe("public view", () => {
  it("never exposes email, client key, token or claim", () => {
    const view = publicHelpView(
      request({
        claim: {
          principalId: "scholar-1",
          name: "আব্দুল্লাহ",
          category: "মুফতি",
          email: "mufti@example.com",
          at: now,
          expiresAt: later,
        },
      }),
    );
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("karim@example.com");
    expect(serialized).not.toContain("client-hash");
    expect(serialized).not.toContain("digest");
    expect(serialized).not.toContain("mufti@example.com");
    expect(serialized).not.toContain("scholar-1");
    expect(serialized).not.toContain("AI উত্তর");
    expect(view.answer).toBeNull();
  });

  it("shows the answer and masala path only once answered", () => {
    const answered = request({
      status: "answered",
      answer: "উত্তর",
      answeredAt: now,
      answeredBy: { id: "scholar-1", name: "আব্দুল্লাহ", category: "মুফতি", email: "x@y.z" },
      published: true,
      masalaId: "66e6a1b2c3d4e5f607182900",
    });
    const view = publicHelpView(answered);
    expect(view.answer).toBe("উত্তর");
    expect(view.answeredBy).toEqual({ name: "আব্দুল্লাহ", category: "মুফতি" });
    expect(view.masalaPath).toBe("/masail/66e6a1b2c3d4e5f607182900");

    const reopened = publicHelpView({ ...answered, status: "open" });
    expect(reopened.answer).toBeNull();
    expect(reopened.answeredBy).toBeNull();
    expect(reopened.masalaPath).toBeNull();
  });
});

describe("staff summary", () => {
  it("masks the requester email for everyone but admins", () => {
    expect(helpSummary(request(), scholar, now).email).toBe("k***@example.com");
    expect(helpSummary(request(), moderator, now).email).toBe("k***@example.com");
    expect(helpSummary(request(), admin, now).email).toBe("karim@example.com");
  });

  it("ignores an expired claim", () => {
    const doc = request({
      claim: {
        principalId: "scholar-2",
        name: "ইউসুফ",
        category: "আলেম",
        email: "y@example.com",
        at: earlier,
        expiresAt: earlier,
      },
    });
    expect(helpSummary(doc, scholar, now).claim).toBeNull();
  });
});

describe("permissions", () => {
  const claimed = request({
    claim: {
      principalId: "scholar-1",
      name: "আব্দুল্লাহ",
      category: "মুফতি",
      email: "mufti@example.com",
      at: now,
      expiresAt: later,
    },
  });

  it("lets the claimant act and blocks other scholars", () => {
    expect(permissionsFor(claimed, scholar, now)).toMatchObject({
      claim: true,
      release: true,
      answer: true,
      close: true,
      reopen: false,
      delete: false,
    });
    expect(permissionsFor(claimed, otherScholar, now)).toMatchObject({
      claim: false,
      release: false,
      answer: false,
      close: false,
    });
  });

  it("lets an admin override a claim and manage finished requests", () => {
    expect(permissionsFor(claimed, admin, now)).toMatchObject({
      claim: true,
      release: true,
      answer: true,
      reassign: true,
      delete: true,
    });
    const answered = request({ status: "answered" });
    expect(permissionsFor(answered, admin, now)).toMatchObject({ answer: true, reopen: true });
    expect(permissionsFor(answered, scholar, now)).toMatchObject({ answer: false, reopen: false });
  });

  it("keeps moderators read-only", () => {
    expect(Object.values(permissionsFor(request(), moderator, now)).some(Boolean)).toBe(false);
  });
});

describe("list filters and cursors", () => {
  it("separates unclaimed, claimed and own requests", () => {
    expect(filterFor("open", scholar, now)).toEqual({
      status: "open",
      $or: [{ claim: { $exists: false } }, { "claim.expiresAt": { $lte: now } }],
    });
    expect(filterFor("mine", scholar, now)).toEqual({
      status: "open",
      "claim.principalId": "scholar-1",
      "claim.expiresAt": { $gt: now },
    });
    expect(parseFilter("bogus")).toBe("open");
    expect(parseFilter("closed")).toBe("closed");
  });

  it("round-trips a cursor and pages in either direction", () => {
    const cursor = parseHelpCursor(encodeHelpCursor({ _id: id, createdAt: now }));
    expect(cursor.createdAt.getTime()).toBe(now.getTime());
    expect(cursor.id.equals(id)).toBe(true);
    expect(afterCursor(cursor, true)).toEqual({
      $or: [{ createdAt: { $gt: now } }, { createdAt: now, _id: { $gt: cursor.id } }],
    });
    expect(() => parseHelpCursor("abc")).toThrow(AdminError);
  });
});
