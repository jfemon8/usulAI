import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn(() => Promise.reject(new Error("no db"))) }));

const verified = await import("@/lib/analytics/verifiedAnswers");
const { canEditMasala, conflictMessage, toWorkspaceMasala } =
  await import("@/lib/reviews/scholarAnswers");

const id = new ObjectId("66e6a1b2c3d4e5f60718293a");
const author = { id: "staff-1", name: "করিম", category: "মুফতি" };
const scholar = {
  principalId: "staff-1",
  name: "করিম",
  categoryName: "মুফতি",
  email: "karim@example.com",
  role: "scholar" as const,
};

describe("scholar answer queries", () => {
  it("filters scholar answers by author, publication and escaped search", () => {
    expect(
      verified.scholarAnswerFilter({ authorId: "staff-1", published: true, search: " a.b " }),
    ).toEqual({
      origin: { $ne: "auto" },
      "author.id": "staff-1",
      published: true,
      question: { $regex: "a\\.b", $options: "i" },
    });
  });

  it("round-trips the workspace cursor and refuses malformed ones", () => {
    const createdAt = new Date("2026-09-15T10:00:00Z");
    const cursor = verified.parseScholarCursor(
      verified.encodeScholarCursor({ _id: id, createdAt }),
    );
    expect(cursor?.createdAt?.getTime()).toBe(createdAt.getTime());
    expect(cursor?.id.equals(id)).toBe(true);
    expect(verified.parseScholarCursor("nope")).toBeNull();
  });
});

describe("masala permissions", () => {
  it("lets authors and admins edit, and nobody else", () => {
    expect(canEditMasala({ author }, scholar)).toBe(true);
    expect(canEditMasala({ author }, { ...scholar, principalId: "staff-2" })).toBe(false);
    expect(canEditMasala({ author }, { ...scholar, principalId: "x", role: "admin" })).toBe(true);
    expect(canEditMasala({ author: undefined }, scholar)).toBe(false);
  });

  it("hides the editor's email from other scholars and links only published masail", () => {
    const row = {
      _id: id,
      question: "প্রশ্ন",
      normalizedQuestion: "প্রশ্ন",
      answer: "**উত্তর**",
      sources: [],
      author,
      origin: "scholar" as const,
      published: false,
      updatedBy: "karim@example.com",
      createdAt: new Date("2026-09-15T10:00:00Z"),
      servedCount: 3,
    };
    const other = toWorkspaceMasala(row, { ...scholar, principalId: "staff-2" });
    expect(other.canEdit).toBe(false);
    expect(other.updatedBy).toBeNull();
    expect(other.path).toBeNull();
    const own = toWorkspaceMasala({ ...row, published: true }, scholar);
    expect(own.updatedBy).toBe("karim@example.com");
    expect(own.path).toBe(verified.masalaPath(id.toHexString()));
    expect(own.excerpt).toBe("উত্তর");
  });

  it("names the existing masala in a conflict", () => {
    expect(conflictMessage({ question: "কসর কত দিন?", author })).toContain("মুফতি করিম");
    expect(conflictMessage({ question: "কসর কত দিন?", author })).toContain("কসর কত দিন?");
  });
});
