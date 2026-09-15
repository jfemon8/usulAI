import { describe, expect, it } from "vitest";
import { helpAnsweredEmail } from "@/lib/email/templates/helpAnswered";

const site = {
  appName: "Test Deen",
  appUrl: "https://deen.example.org/",
  supportEmail: "help@deen.example.org",
  logoUrl: "https://deen.example.org/logo.png",
  now: new Date("2026-09-15T03:30:00Z"),
};

const data = {
  email: "reader@example.com",
  name: "করিম",
  question: `সফরে কসর <b>নামাজ</b> কত দিন? ${"বিস্তারিত ".repeat(60)}`,
  scholarName: "আব্দুল্লাহ",
  scholarCategory: "মুফতি",
  trackUrl: "https://deen.example.org/help/r.66e6a1b2c3d4e5f60718293a.abc",
};

describe("helpAnsweredEmail", () => {
  it("renders Bangla by default with the scholar, excerpt and tracking button", () => {
    const email = helpAnsweredEmail(data, site);
    expect(email.subject).toBe("Test Deen: আপনার প্রশ্নের উত্তর দিয়েছেন মুফতি আব্দুল্লাহ");
    expect(email.html).toContain(
      'href="https://deen.example.org/help/r.66e6a1b2c3d4e5f60718293a.abc"',
    );
    expect(email.html).toContain("&lt;b&gt;নামাজ&lt;/b&gt;");
    expect(email.html).not.toContain("<b>নামাজ</b>");
    expect(email.text).toContain("উত্তর দেখুন: https://deen.example.org/help/");
    expect(email.text).toContain("…");
    expect(email.text).not.toContain("বিস্তারিত ".repeat(60));
  });

  it("renders English and the masala link when published", () => {
    const email = helpAnsweredEmail(
      { ...data, masalaUrl: "https://deen.example.org/masail/66e6a1b2c3d4e5f607182900" },
      { ...site, locale: "en" },
    );
    expect(email.subject).toBe("Test Deen: মুফতি আব্দুল্লাহ answered your question");
    expect(email.text).toContain("Read the answer: https://deen.example.org/help/");
    expect(email.text).toContain("https://deen.example.org/masail/66e6a1b2c3d4e5f607182900");
  });

  it("refuses a non-http tracking link", () => {
    expect(() => helpAnsweredEmail({ ...data, trackUrl: "javascript:alert(1)" }, site)).toThrow();
  });
});
