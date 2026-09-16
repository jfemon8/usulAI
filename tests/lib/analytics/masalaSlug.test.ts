import { describe, expect, it } from "vitest";
import { MASAIL_CONFIG } from "@/config/site";
import {
  masalaIdFromSlug,
  masalaPath,
  masalaSegment,
  masalaSlug,
  normalizeQuestion,
} from "@/lib/analytics/verifiedAnswers";

const ID = "6aaa1d56812ca39ec173b9d9";

describe("masala slugs", () => {
  it("keeps Bengali vowel signs, which are marks and not letters", () => {
    expect(masalaSlug("নামাজ ভঙ্গের কারণ কয়টি?")).toBe("নামাজ-ভঙ্গের-কারণ-কয়টি");
    expect(masalaSlug("যাকাতের নিসাব কত?")).toBe("যাকাতের-নিসাব-কত");
  });

  it("drops punctuation and collapses separators", () => {
    expect(masalaSlug("  রোজা  ভাঙলে, কী করণীয়?? ")).toBe("রোজা-ভাঙলে-কী-করণীয়");
  });

  it("stays inside the length budget without cutting a word in half", () => {
    const slug = masalaSlug("নামাজ ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(MASAIL_CONFIG.slugChars);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.split("-").every((word) => word === "নামাজ")).toBe(true);
  });

  it("builds a path the router can read back", () => {
    const question = "হজ কার উপর ফরজ?";
    const path = masalaPath(ID, question);

    expect(path.startsWith(`${MASAIL_CONFIG.path}/`)).toBe(true);
    expect(masalaIdFromSlug(path.split("/").at(-1) ?? "")).toBe(ID);
    expect(masalaSegment(ID, question)).toBe(`${ID}-${masalaSlug(question)}`);
  });

  it("falls back to the bare id when there is no question", () => {
    expect(masalaPath(ID)).toBe(`${MASAIL_CONFIG.path}/${ID}`);
    expect(masalaIdFromSlug(ID)).toBe(ID);
    expect(masalaIdFromSlug("not-an-id")).toBeNull();
  });
});

describe("question normalisation", () => {
  it("does not strip Bengali marks, so different words stay different", () => {
    expect(normalizeQuestion("নামাজ")).not.toBe(normalizeQuestion("নমজ"));
    expect(normalizeQuestion("  যাকাত কাদের উপর ফরজ?  ")).toBe("যাকাত কাদের উপর ফরজ");
  });
});
