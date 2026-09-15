import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { answersAfter, encodeAnswerCursor, parseAnswerCursor } from "@/lib/admin/answers";
import { AdminError } from "@/lib/admin/http";

const id = new ObjectId("66e6a1b2c3d4e5f60718293a");

describe("answer list cursor", () => {
  it("round-trips a dated row", () => {
    const createdAt = new Date("2026-09-15T10:00:00Z");
    const cursor = parseAnswerCursor(encodeAnswerCursor({ _id: id, createdAt }));
    expect(cursor.createdAt?.getTime()).toBe(createdAt.getTime());
    expect(cursor.id.equals(id)).toBe(true);
  });

  it("round-trips a row without a creation date", () => {
    const encoded = encodeAnswerCursor({ _id: id });
    expect(encoded).toBe(`-.${id.toHexString()}`);
    expect(parseAnswerCursor(encoded).createdAt).toBeNull();
  });

  it("rejects malformed cursors", () => {
    for (const value of ["", "abc", "12.xyz", `12${id.toHexString()}`, "1.2.3"]) {
      expect(() => parseAnswerCursor(value)).toThrow(AdminError);
    }
  });

  it("continues after a dated row, including undated rows sorted last", () => {
    const createdAt = new Date("2026-09-15T10:00:00Z");
    expect(answersAfter({ createdAt, id })).toEqual({
      $or: [
        { createdAt: { $lt: createdAt } },
        { createdAt: { $not: { $type: "date" } } },
        { createdAt, _id: { $lt: id } },
      ],
    });
  });

  it("continues among undated rows by id only", () => {
    expect(answersAfter({ createdAt: null, id })).toEqual({
      createdAt: { $not: { $type: "date" } },
      _id: { $lt: id },
    });
  });
});
