import { describe, expect, it } from "vitest";
import { isArabicText, mergeChunks, pageBlocks } from "@/lib/sourceView/pageText";
import { mirror, splitRightToLeftToken, wrapWords } from "@/lib/sourceView/textLayout";

const first = "620 - وأجمعوا أن السارق إذا سرق مرات إذا قدم إلى الحاكم في آخر السرقات.";
const second = "621 - وأجمعوا في أن قطع يد السارق إذا شهد عليه بالسرقة شاهدان عدلان.";
const third = "622 - وأجمعوا على أن الشاهدين إذا شهدا على سارق فقطعت يده.";

describe("mergeChunks", () => {
  it("rebuilds a page from overlapping chunks and remembers where each chunk sits", () => {
    const page = `${first}\n${second}\n${third}`;
    const chunkA = `${first}\n${second}`;
    const chunkB = `${second}\n${third}`;
    const merged = mergeChunks([chunkA, chunkB], 400);

    expect(merged.text).toBe(page);
    expect(merged.text.slice(merged.spans[1]?.start, merged.spans[1]?.end)).toBe(chunkB);
  });

  it("joins chunks that do not overlap with a line break", () => {
    expect(mergeChunks([first, third], 400).text).toBe(`${first}\n${third}`);
  });
});

describe("pageBlocks", () => {
  it("highlights the referenced chunk and widens it to whole lines", () => {
    const text = `${first}\n${second}\n${third}`;
    const start = text.indexOf("وأجمعوا في");
    const blocks = pageBlocks(text, { start, end: text.indexOf(third) - 1 });

    expect(blocks.map((block) => Boolean(block.highlight))).toEqual([false, true, false]);
    expect(blocks[1]?.text).toBe(second);
    expect(blocks.every((block) => block.kind === "arabic")).toBe(true);
  });
});

describe("right-to-left layout helpers", () => {
  it("detects Arabic by its letters, not by digits or labels", () => {
    expect(isArabicText("621 - وأجمعوا")).toBe(true);
    expect(isArabicText("পৃষ্ঠা 123")).toBe(false);
  });

  it("separates punctuation so it can be placed on the correct side and mirrored", () => {
    expect(splitRightToLeftToken("(رحمه")).toEqual({ leading: "(", core: "رحمه", trailing: "" });
    expect(splitRightToLeftToken("الحرز:")).toEqual({ leading: "", core: "الحرز", trailing: ":" });
    expect(mirror("(")).toBe(")");
  });

  it("wraps words by measured width and keeps detached punctuation with its word", () => {
    const lines = wrapWords("أ ب ج د .", 4, (value) => value.length);
    expect(lines).toEqual([
      ["أ", "ب"],
      ["ج", "د."],
    ]);
  });
});
