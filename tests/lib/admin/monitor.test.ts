import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { AdminError } from "@/lib/admin/http";
import {
  encodeLogCursor,
  monitorFilter,
  parseLogCursor,
  parseMonitorFilters,
  rangeStart,
  startOfDay,
  toLogDetail,
  toLogRow,
  unansweredShare,
} from "@/lib/admin/monitor";

const id = new ObjectId("66e6a1b2c3d4e5f60718293a");
const now = Date.parse("2026-09-15T20:30:00Z");

describe("monitor filters", () => {
  it("falls back to safe defaults for unknown values", () => {
    const filters = parseMonitorFilters(
      new URLSearchParams("range=year&status=weird&language=fr&source=bible&model="),
    );
    expect(filters).toMatchObject({ range: "7d", status: "all" });
    expect(filters.language).toBeUndefined();
    expect(filters.source).toBeUndefined();
    expect(filters.model).toBeUndefined();
  });

  it("keeps valid values", () => {
    const filters = parseMonitorFilters(
      new URLSearchParams("range=today&status=unanswered&language=banglish&source=fiqh&model=glm"),
    );
    expect(filters).toMatchObject({
      range: "today",
      status: "unanswered",
      language: "banglish",
      source: "fiqh",
      model: "glm",
    });
  });

  it("starts today at midnight in Dhaka", () => {
    expect(startOfDay(now, "Asia/Dhaka").toISOString()).toBe("2026-09-15T18:00:00.000Z");
    expect(startOfDay(Date.parse("2026-09-15T10:00:00Z"), "Asia/Dhaka").toISOString()).toBe(
      "2026-09-14T18:00:00.000Z",
    );
    expect(startOfDay(now, "UTC").toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("measures week and month ranges back from now", () => {
    expect(rangeStart("7d", now).getTime()).toBe(now - 7 * 86_400_000);
    expect(rangeStart("30d", now).getTime()).toBe(now - 30 * 86_400_000);
  });

  it("builds an unanswered, scoped, paged filter without clashing $or clauses", () => {
    const createdAt = new Date("2026-09-14T10:00:00Z");
    const filter = monitorFilter(
      {
        range: "30d",
        status: "unanswered",
        language: "bangla",
        source: "hadith",
        model: "glm-4.5-flash",
        cursor: encodeLogCursor({ createdAt, _id: id }),
      },
      now,
    );
    expect(filter).toEqual({
      createdAt: { $gte: new Date(now - 30 * 86_400_000) },
      language: "bangla",
      scopedTo: "hadith",
      modelId: "glm-4.5-flash",
      $and: [
        { $or: [{ answered: false }, { retrievedCount: 0 }] },
        {
          $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: id } }],
        },
      ],
    });
  });

  it("requires context for the answered filter", () => {
    expect(monitorFilter({ range: "7d", status: "answered" }, now)).toMatchObject({
      answered: true,
      retrievedCount: { $gt: 0 },
    });
  });
});

describe("monitor cursor", () => {
  it("round-trips", () => {
    const createdAt = new Date("2026-09-15T10:00:00Z");
    const cursor = parseLogCursor(encodeLogCursor({ createdAt, _id: id }));
    expect(cursor.createdAt.getTime()).toBe(createdAt.getTime());
    expect(cursor.id.equals(id)).toBe(true);
  });

  it("rejects malformed cursors", () => {
    for (const value of ["", "abc", "12_" + id.toHexString(), `x.${id.toHexString()}`, "1.2"]) {
      expect(() => parseLogCursor(value)).toThrow(AdminError);
    }
  });
});

describe("monitor rows", () => {
  const log = {
    _id: id,
    question: "প্রশ্ন ".repeat(80),
    searchQuery: "খোঁজ",
    rewritten: true,
    historyTurns: 2,
    scopedTo: ["quran"],
    language: "bangla",
    createdAt: new Date("2026-09-15T08:57:38Z"),
    sourcesUsed: ["quran", "hadith"],
    retrievedCount: 0,
    topScore: null,
    vectorHits: 0,
    textHits: 3,
    references: ["Al-Alaq 96:19"],
    answered: true,
    modelTier: "reserve",
    modelId: "glm-4.5-flash",
    attempt: 5,
    loopCut: false,
    gateRejections: [{ modelId: "qwen", reasons: ["loop", "script"] }],
    firstTokenMs: 812.4,
    note: "ignored",
  } as never;

  it("summarises a log for the list", () => {
    const row = toLogRow(log);
    expect(row.question.length).toBeLessThanOrEqual(281);
    expect(row.question.endsWith("…")).toBe(true);
    expect(row).toMatchObject({
      id: id.toHexString(),
      answered: true,
      noContext: true,
      gateRejections: 1,
      loopCut: false,
      createdAt: "2026-09-15T08:57:38.000Z",
    });
  });

  it("keeps the full question, rejection reasons and timings in the detail", () => {
    const detail = toLogDetail(log);
    expect(detail.question.length).toBeGreaterThan(400);
    expect(detail.rejectionDetails).toEqual([{ modelId: "qwen", reasons: ["loop", "script"] }]);
    expect(detail.timings).toEqual({ firstTokenMs: 812.4 });
    expect(detail.attempt).toBe(5);
  });

  it("tolerates a null rejection list", () => {
    expect(toLogRow({ ...(log as object), gateRejections: null } as never).gateRejections).toBe(0);
  });

  it("computes the unanswered share", () => {
    expect(unansweredShare({ total: 0, unanswered: 0 })).toBeNull();
    expect(unansweredShare({ total: 8, unanswered: 2 })).toBe(0.25);
  });
});
