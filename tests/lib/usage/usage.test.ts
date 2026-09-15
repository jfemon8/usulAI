import { describe, expect, it } from "vitest";
import { usageFrom } from "@/lib/security/rateLimit";
import {
  formatDuration,
  isUsageCommand,
  localUsage,
  remainingToday,
  usageLevel,
} from "@/lib/usage/usageView";
import type { UsulUIMessage } from "@/types";

const limits = { minute: 5, hour: 30, day: 100 };

describe("usageFrom", () => {
  const now = Date.UTC(2026, 8, 15, 10, 30, 20);
  const minute = Math.floor(now / 60_000);
  const hour = Math.floor(now / 3_600_000);
  const day = Math.floor(now / 86_400_000);

  it("reports the counters of the current windows with their reset times", () => {
    const usage = usageFrom(
      { minute: { w: minute, c: 3 }, hour: { w: hour, c: 12 }, day: { w: day, c: 40 } },
      limits,
      now,
    );

    expect(usage.minute).toEqual({ used: 3, limit: 5, resetsAt: (minute + 1) * 60_000 });
    expect(usage.hour.used).toBe(12);
    expect(usage.day).toEqual({ used: 40, limit: 100, resetsAt: (day + 1) * 86_400_000 });
  });

  it("counts a window that has already rolled over as unused", () => {
    const usage = usageFrom({ minute: { w: minute - 1, c: 5 } }, limits, now);

    expect(usage.minute.used).toBe(0);
    expect(usage.hour.used).toBe(0);
  });
});

describe("usage presentation", () => {
  it("changes colour level near and at the limit", () => {
    expect(usageLevel(3, 10)).toBe("normal");
    expect(usageLevel(7, 10)).toBe("warning");
    expect(usageLevel(9, 10)).toBe("critical");
    expect(usageLevel(12, 10)).toBe("critical");
  });

  it("writes durations in Bangla", () => {
    expect(formatDuration(42_000)).toBe("৪২ সেকেন্ড");
    expect(formatDuration(3 * 60_000 + 5_000)).toBe("৩ মিনিট ৫ সেকেন্ড");
    expect(formatDuration(5 * 3_600_000 + 12 * 60_000)).toBe("৫ ঘণ্টা ১২ মিনিট");
  });

  it("recognises the command only on its own", () => {
    expect(isUsageCommand("/usage")).toBe(true);
    expect(isUsageCommand("  /USAGE ")).toBe(true);
    expect(isUsageCommand("/usage কী?")).toBe(false);
    expect(isUsageCommand("usage")).toBe(false);
  });

  it("gives the questions left today from the personal daily limit only", () => {
    const window = (used: number, limit: number) => ({ used, limit, resetsAt: 0 });
    expect(remainingToday({ day: window(40, 100) })).toBe(60);
    expect(remainingToday({ day: window(120, 100) })).toBe(0);
  });

  it("summarises the conversation", () => {
    const message = (role: "user" | "assistant", index: number): UsulUIMessage => ({
      id: `${role}-${index}`,
      role,
      parts: [{ type: "text", text: `${role} ${index}` }],
    });
    const messages = Array.from({ length: 44 }, (_, index) =>
      message(index % 2 === 0 ? "user" : "assistant", index),
    );
    const conversations = [
      { id: "a", title: "নতুন", updatedAt: 2_000, messages: [] },
      { id: "b", title: "পুরনো", updatedAt: 1_000, messages: [] },
    ];

    const usage = localUsage(conversations, messages);

    expect(usage).toMatchObject({
      conversations: 2,
      messages: 44,
      questions: 22,
    });
  });
});
