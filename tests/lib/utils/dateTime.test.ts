import { describe, expect, it } from "vitest";
import { formatTimestamp } from "@/lib/utils/dateTime";

describe("formatTimestamp", () => {
  it("writes dd MMMM yyyy, hh:mm:ss AM/PM in Dhaka time", () => {
    expect(formatTimestamp("2026-09-15T08:18:55Z")).toBe("15 September 2026, 02:18:55 PM");
    expect(formatTimestamp(new Date("2026-03-05T01:02:03Z"))).toBe("05 March 2026, 07:02:03 AM");
  });

  it("handles midnight, noon and a date that crosses into the next day in Dhaka", () => {
    expect(formatTimestamp("2026-09-14T18:00:00Z")).toBe("15 September 2026, 12:00:00 AM");
    expect(formatTimestamp("2026-09-15T06:00:00Z")).toBe("15 September 2026, 12:00:00 PM");
    expect(formatTimestamp(Date.UTC(2025, 11, 31, 18, 30, 5))).toBe("01 January 2026, 12:30:05 AM");
  });

  it("returns null for an invalid date", () => {
    expect(formatTimestamp("not a date")).toBeNull();
  });
});
