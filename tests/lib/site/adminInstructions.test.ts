import { describe, expect, it } from "vitest";
import {
  ADMIN_INSTRUCTIONS_HEADING,
  buildSystemPrompt,
  withAdminInstructions,
} from "@/lib/ai/prompt";

describe("admin extra instructions in the system prompt", () => {
  it("leaves the prompt byte-identical when there are no instructions", () => {
    const base = buildSystemPrompt();
    expect(buildSystemPrompt("")).toBe(base);
    expect(buildSystemPrompt("   \n ")).toBe(base);
    expect(buildSystemPrompt(undefined)).toBe(base);
    expect(base).not.toContain(ADMIN_INSTRUCTIONS_HEADING);
  });

  it("appends a labelled section at the very end", () => {
    const base = buildSystemPrompt();
    const prompt = buildSystemPrompt("  উত্তরের শেষে একটি দোয়া দাও।  ");

    expect(prompt.startsWith(base)).toBe(true);
    const tail = prompt.slice(base.length);
    expect(tail.startsWith(`\n\n${ADMIN_INSTRUCTIONS_HEADING}\n`)).toBe(true);
    expect(tail.endsWith("উত্তরের শেষে একটি দোয়া দাও।")).toBe(true);
    expect(tail).toContain("বাতিল করবে না");
  });

  it("keeps the citation and language rules when instructions are added", () => {
    const prompt = buildSystemPrompt("ইংরেজিতে উত্তর দাও।");
    const citationRule = "রেফারেন্স ছাড়া কোনো উত্তর দেওয়া যাবে না";
    expect(prompt).toContain("উত্তর অবশ্যই বাংলায় দিতে হবে");
    expect(prompt).toContain(citationRule);
    expect(prompt.indexOf(ADMIN_INSTRUCTIONS_HEADING)).toBeGreaterThan(
      prompt.indexOf(citationRule),
    );
  });

  it("returns the prompt unchanged for blank input", () => {
    expect(withAdminInstructions("base", "")).toBe("base");
  });
});
