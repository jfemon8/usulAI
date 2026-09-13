import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn(), getDocumentsCollection: vi.fn() }));

const { summariseLogs } = await import("@/lib/maintenance/retention");

describe("summariseLogs", () => {
  it("folds repeated phrasings of one question into a single insight", () => {
    const insights = summariseLogs([
      {
        question: "Zakater nisab koto?",
        answered: true,
        retrievedCount: 3,
        topScore: 4.1,
        createdAt: new Date("2026-09-01"),
      },
      {
        question: "  zakater   NISAB koto ",
        answered: false,
        retrievedCount: 0,
        topScore: null,
        createdAt: new Date("2026-09-03"),
      },
      {
        question: "নামাজ কেন ফরজ",
        answered: true,
        retrievedCount: 2,
        topScore: 5,
        createdAt: new Date("2026-09-02"),
      },
    ]);

    expect(insights.size).toBe(2);
    const zakat = [...insights.values()].find((insight) => insight.asked === 2);
    expect(zakat).toMatchObject({
      answered: 1,
      unanswered: 1,
      emptyRetrieval: 1,
      bestTopScore: 4.1,
    });
    expect(zakat?.firstAskedAt).toEqual(new Date("2026-09-01"));
    expect(zakat?.lastAskedAt).toEqual(new Date("2026-09-03"));
  });

  it("skips rows whose question normalises to nothing", () => {
    expect(summariseLogs([{ question: "???", createdAt: new Date() }]).size).toBe(0);
  });
});
