import { describe, expect, it } from "vitest";
import {
  cleanSuggestions,
  DEFAULT_AI_SETTINGS,
  DEFAULT_HOME_CONTENT,
  DEFAULT_QUESTION_POOL,
  enabledModels,
  isExternalLink,
  mergeAiSettings,
  mergeHomeContent,
  safeLinkUrl,
  SITE_CONTENT_LIMITS,
  splitBulkQuestions,
} from "@/lib/site/contentShape";

describe("mergeHomeContent", () => {
  it("returns the defaults for missing or malformed documents", () => {
    expect(mergeHomeContent(null)).toEqual(DEFAULT_HOME_CONTENT);
    expect(mergeHomeContent("broken")).toEqual(DEFAULT_HOME_CONTENT);
    expect(mergeHomeContent({ greeting: 42, suggestions: "no" })).toEqual(DEFAULT_HOME_CONTENT);
  });

  it("keeps the original question pool as the default", () => {
    expect(DEFAULT_QUESTION_POOL.length).toBeGreaterThan(60);
    expect(DEFAULT_HOME_CONTENT.suggestions).toEqual([...DEFAULT_QUESTION_POOL]);
    expect(DEFAULT_HOME_CONTENT.greeting).toBe("আসসালামু আলাইকুম, কী জানতে চান?");
  });

  it("does not let a merged result share the default suggestion array", () => {
    const merged = mergeHomeContent(null);
    merged.suggestions.push("নতুন");
    expect(DEFAULT_HOME_CONTENT.suggestions).not.toContain("নতুন");
  });

  it("merges stored fields over the defaults", () => {
    const merged = mergeHomeContent({
      greeting: "  স্বাগতম  ",
      subtitle: "",
      suggestions: ["নামাজ কী?", " নামাজ   কী? ", "", 7, "রোজা কী?"],
    });

    expect(merged.greeting).toBe("স্বাগতম");
    expect(merged.subtitle).toBe("");
    expect(merged.bismillah).toBe(DEFAULT_HOME_CONTENT.bismillah);
    expect(merged.suggestions).toEqual(["নামাজ কী?", "রোজা কী?"]);
  });

  it("falls back to the default greeting when the stored one is blank", () => {
    expect(mergeHomeContent({ greeting: "   " }).greeting).toBe(DEFAULT_HOME_CONTENT.greeting);
  });

  it("keeps an intentionally empty suggestion list", () => {
    expect(mergeHomeContent({ suggestions: [] }).suggestions).toEqual([]);
  });

  it("disables an announcement without text and drops unsafe links", () => {
    expect(mergeHomeContent({ announcement: { enabled: true, text: "  " } }).announcement).toEqual({
      enabled: false,
      text: "",
      tone: "info",
    });

    const unsafe = mergeHomeContent({
      announcement: {
        enabled: true,
        text: "নোটিশ",
        tone: "warning",
        link: { label: "দেখুন", url: "javascript:alert(1)" },
      },
    }).announcement;
    expect(unsafe).toEqual({ enabled: true, text: "নোটিশ", tone: "warning" });

    const safe = mergeHomeContent({
      announcement: {
        enabled: true,
        text: "নোটিশ",
        tone: "other",
        link: { label: "দেখুন", url: "https://example.org/a" },
      },
    }).announcement;
    expect(safe.tone).toBe("info");
    expect(safe.link).toEqual({ label: "দেখুন", url: "https://example.org/a" });
  });

  it("rejects values longer than their limit", () => {
    const long = "ক".repeat(SITE_CONTENT_LIMITS.greetingChars + 1);
    expect(mergeHomeContent({ greeting: long }).greeting).toBe(DEFAULT_HOME_CONTENT.greeting);
  });
});

describe("cleanSuggestions", () => {
  it("trims, collapses whitespace, dedupes case-insensitively and caps the list", () => {
    expect(cleanSuggestions(["What is Salah?", "what is  salah?", "x".repeat(201)])).toEqual([
      "What is Salah?",
    ]);
    const many = Array.from({ length: 250 }, (_, index) => `প্রশ্ন ${index}`);
    expect(cleanSuggestions(many)).toHaveLength(SITE_CONTENT_LIMITS.maxSuggestions);
  });
});

describe("splitBulkQuestions", () => {
  it("reads one question per line and strips list markers", () => {
    const bullet = String.fromCharCode(0x2022);
    const pasted = ["১. নামাজ কী?", "2) রোজা কী?", "", "- হজ কী?", `${bullet} যাকাত কী?`, "   "];
    expect(splitBulkQuestions(pasted.join("\r\n"))).toEqual([
      "নামাজ কী?",
      "রোজা কী?",
      "হজ কী?",
      "যাকাত কী?",
    ]);
  });
});

describe("safeLinkUrl", () => {
  it("allows only http, https and site-relative paths", () => {
    expect(safeLinkUrl("https://example.org/path?x=1")).toBe("https://example.org/path?x=1");
    expect(safeLinkUrl("http://example.org")).toBe("http://example.org/");
    expect(safeLinkUrl("/usage")).toBe("/usage");
    expect(safeLinkUrl("//evil.example")).toBeNull();
    expect(safeLinkUrl(`/${String.fromCharCode(92)}evil.example`)).toBeNull();
    expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(safeLinkUrl("data:text/html,hi")).toBeNull();
    expect(safeLinkUrl("mailto:a@b.c")).toBeNull();
    expect(safeLinkUrl("")).toBeNull();
  });

  it("marks only absolute URLs as external", () => {
    expect(isExternalLink("https://example.org")).toBe(true);
    expect(isExternalLink("/embed")).toBe(false);
  });
});

describe("mergeAiSettings", () => {
  it("returns the defaults for missing documents", () => {
    expect(mergeAiSettings(undefined)).toEqual(DEFAULT_AI_SETTINGS);
    expect(DEFAULT_AI_SETTINGS.verifiedAnswersEnabled).toBe(true);
  });

  it("keeps valid fields and cleans the disabled model list", () => {
    expect(
      mergeAiSettings({
        extraInstructions: "  সংক্ষেপে লেখো। ",
        disabledModels: ["glm-4.7-flash", " glm-4.7-flash", "", 3],
        verifiedAnswersEnabled: false,
      }),
    ).toEqual({
      extraInstructions: "সংক্ষেপে লেখো।",
      disabledModels: ["glm-4.7-flash"],
      verifiedAnswersEnabled: false,
    });
  });

  it("ignores instructions over the limit", () => {
    const long = "ক".repeat(SITE_CONTENT_LIMITS.extraInstructionsChars + 1);
    expect(mergeAiSettings({ extraInstructions: long }).extraInstructions).toBe("");
  });
});

describe("enabledModels", () => {
  const chain = [{ modelId: "a" }, { modelId: "b" }, { modelId: "c" }];

  it("removes disabled models and keeps the order", () => {
    expect(enabledModels(chain, ["b"])).toEqual([{ modelId: "a" }, { modelId: "c" }]);
  });

  it("ignores the filter when it would leave no model", () => {
    expect(enabledModels(chain, ["a", "b", "c"])).toEqual(chain);
    expect(enabledModels([], ["a"])).toEqual([]);
  });
});
