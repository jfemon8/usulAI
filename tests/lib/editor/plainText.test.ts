import { describe, expect, it } from "vitest";
import { markdownExcerpt, markdownToPlainText } from "@/lib/editor/plainText";

describe("markdown excerpts", () => {
  it("keeps the words and drops markdown syntax, tables pipes and dividers", () => {
    const markdown = [
      "## রোজার বিধান",
      "",
      "**রোজা** অবস্থায় *মিসওয়াক* করা যায় [1]।",
      "",
      "---",
      "",
      "| বিষয় | হুকুম |",
      "| --- | --- |",
      "| মিসওয়াক | জায়েজ |",
      "",
      "> সতর্ক থাকুন",
      "",
      "- পানি গিলবেন না",
      "- [সূত্র](https://example.com)",
    ].join("\n");

    const plain = markdownToPlainText(markdown);
    expect(plain).toBe(
      "রোজার বিধান রোজা অবস্থায় মিসওয়াক করা যায় [1]। বিষয় হুকুম মিসওয়াক জায়েজ সতর্ক থাকুন পানি গিলবেন না সূত্র",
    );
    expect(plain).not.toMatch(/[|#*>]|---/);
  });

  it("shortens long text with an ellipsis", () => {
    expect(markdownExcerpt("শব্দ ".repeat(100), 20)).toBe("শব্দ শব্দ শব্দ শব্দ…");
  });
});
