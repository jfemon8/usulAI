import { describe, expect, it } from "vitest";
import {
  bengaliCalendarDate,
  bengaliLabel,
  clockLabel,
  hijriCalendarDate,
  isValidTimeZone,
  spokenClock,
  zonedParts,
} from "@/lib/general/calendar";

describe("bengaliCalendarDate", () => {
  it.each([
    [
      { year: 2026, month: 4, day: 14 },
      { year: 1433, month: 1, day: 1 },
    ],
    [
      { year: 2026, month: 4, day: 13 },
      { year: 1432, month: 12, day: 30 },
    ],
    [
      { year: 2026, month: 9, day: 28 },
      { year: 1433, month: 6, day: 13 },
    ],
    [
      { year: 2025, month: 12, day: 16 },
      { year: 1432, month: 9, day: 1 },
    ],
    [
      { year: 2026, month: 2, day: 21 },
      { year: 1432, month: 11, day: 8 },
    ],
    [
      { year: 2024, month: 4, day: 13 },
      { year: 1430, month: 12, day: 30 },
    ],
  ])("converts %o", (date, expected) => {
    expect(bengaliCalendarDate(date)).toEqual(expected);
  });

  it("labels the date in Bangla and English", () => {
    const date = bengaliCalendarDate({ year: 2026, month: 9, day: 28 });
    expect(bengaliLabel(date, "bn")).toBe("১৩ আশ্বিন ১৪৩৩ বঙ্গাব্দ");
    expect(bengaliLabel(date, "en")).toBe("13 Ashwin 1433 BS");
  });
});

describe("hijriCalendarDate", () => {
  it("follows the Umm al-Qura calendar", () => {
    expect(hijriCalendarDate({ year: 2026, month: 9, day: 28 }, 0)).toEqual({
      year: 1448,
      month: 4,
      day: 17,
    });
  });
});

describe("clocks and zones", () => {
  it("reads the local wall clock of a time zone", () => {
    const parts = zonedParts(new Date("2026-09-28T14:15:00Z"), "Asia/Dhaka");
    expect(parts).toMatchObject({
      year: 2026,
      month: 9,
      day: 28,
      hour: 20,
      minute: 15,
      weekday: 1,
    });
  });

  it("formats times the way people say them", () => {
    expect(spokenClock(20, 15)).toBe("রাত ৮টা ১৫ মিনিট");
    expect(spokenClock(5, 0)).toBe("ভোর ৫টা");
    expect(clockLabel(13, 5, "bn")).toBe("দুপুর ১:০৫");
    expect(clockLabel(0, 30, "en")).toBe("12:30 AM");
  });

  it("accepts only real time zones", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});
