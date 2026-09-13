import { describe, expect, it } from "vitest";
import { recommendThreshold } from "@/lib/retrieval/calibration";

describe("recommendThreshold", () => {
  it("takes the midpoint when relevant and noise scores do not overlap", () => {
    const result = recommendThreshold([0.85, 0.87, 0.86], [0.76, 0.77]);

    expect(result.separated).toBe(true);
    expect(result.threshold).toBe(0.81);
    expect(result.margin).toBe(0.08);
  });

  it("falls back to a low percentile of relevant scores when they overlap noise", () => {
    const result = recommendThreshold([0.8, 0.82, 0.9, 0.91, 0.92], [0.85]);

    expect(result.separated).toBe(false);
    expect(result.threshold).toBe(0.8);
    expect(result.margin).toBeLessThan(0);
  });
});
