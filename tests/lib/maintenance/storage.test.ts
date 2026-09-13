import { describe, expect, it } from "vitest";
import { STORAGE_BUDGET } from "@/config/site";
import { bytesToFree, describeUsage, QUOTA_BYTES } from "@/lib/maintenance/storage";

describe("bytesToFree", () => {
  it("frees nothing while usage is below the eviction threshold", () => {
    expect(bytesToFree(QUOTA_BYTES * 0.5)).toBe(0);
    expect(bytesToFree(QUOTA_BYTES * (STORAGE_BUDGET.evictAtRatio - 0.01))).toBe(0);
  });

  it("frees back down to the target ratio once the threshold is crossed", () => {
    const used = QUOTA_BYTES * 0.95;
    expect(bytesToFree(used)).toBe(Math.ceil(used - QUOTA_BYTES * STORAGE_BUDGET.targetRatio));
  });
});

describe("describeUsage", () => {
  it("reports megabytes and the share of the quota", () => {
    expect(describeUsage({ usedBytes: 256 * 1024 * 1024, quotaBytes: 512 * 1024 * 1024 })).toBe(
      "256.0 MB of 512.0 MB (50.0%)",
    );
  });
});
