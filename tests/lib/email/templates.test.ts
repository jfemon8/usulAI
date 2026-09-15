import { afterEach, describe, expect, it, vi } from "vitest";
import { appLink, emailContext, passwordResetEmail, welcomeEmail } from "@/lib/email/templates";

afterEach(() => {
  vi.unstubAllEnvs();
});

const site = {
  appName: "Test Deen",
  appUrl: "https://deen.example.org/",
  supportEmail: "help@deen.example.org",
  now: new Date("2026-09-15T03:30:00Z"),
};

describe("email context", () => {
  it("takes the domain, sender and support address from the environment", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://usulai.is-a.bot");
    vi.stubEnv("EMAIL_FROM", "noreply@mail.usulai.is-a.bot");
    vi.stubEnv("SUPPORT_EMAIL", "");
    vi.stubEnv("EMAIL_LOGO_URL", "");
    const context = emailContext();

    expect(context.appUrl).toBe("https://usulai.is-a.bot");
    expect(context.appHost).toBe("usulai.is-a.bot");
    expect(context.logoUrl).toBe("https://usulai.is-a.bot/pwa/icon-192.png");
    expect(context.supportEmail).toBe("noreply@mail.usulai.is-a.bot");
    expect(appLink(context, "/reset-password", { token: "a b" })).toBe(
      "https://usulai.is-a.bot/reset-password?token=a+b",
    );
  });
});

describe("passwordResetEmail", () => {
  const data = {
    email: "user@example.com",
    name: "আব্দুল্লাহ",
    resetUrl: "https://deen.example.org/reset-password?token=abc",
    expiresInMinutes: 30,
    ipAddress: "203.0.113.24",
  };

  it("fills every value from the site context and the request", () => {
    const email = passwordResetEmail(data, site);

    expect(email.subject).toBe("Test Deen: আপনার পাসওয়ার্ড রিসেট করুন");
    expect(email.html).toContain('href="https://deen.example.org/reset-password?token=abc"');
    expect(email.html).toContain("৩০ মিনিট");
    expect(email.html).toContain("help@deen.example.org");
    expect(email.html).toContain("deen.example.org</a> · © 2026 Test Deen");
    expect(email.html).toContain("203.0.113.24");
    expect(email.html).not.toContain("usulai");
    expect(email.text).toContain(
      "নতুন পাসওয়ার্ড সেট করুন: https://deen.example.org/reset-password?token=abc",
    );
  });

  it("writes English for an English reader", () => {
    const email = passwordResetEmail({ ...data, name: undefined }, { ...site, locale: "en" });

    expect(email.subject).toBe("Test Deen: Reset your password");
    expect(email.html).toContain("Assalamu alaikum,");
    expect(email.html).toContain("30 minutes");
    expect(email.html).toContain('lang="en"');
  });

  it("escapes user supplied values and refuses unsafe links", () => {
    const email = passwordResetEmail({ ...data, name: '<script>alert("x")</script>' }, site);
    expect(email.html).not.toContain("<script>alert");
    expect(email.html).toContain("&lt;script&gt;");

    expect(() => passwordResetEmail({ ...data, resetUrl: "javascript:alert(1)" }, site)).toThrow(
      /http or https/,
    );
  });
});

describe("welcomeEmail", () => {
  it("asks for verification when a verification link is given", () => {
    const email = welcomeEmail(
      { email: "new@example.com", verifyUrl: "https://deen.example.org/verify-email?token=v" },
      site,
    );

    expect(email.subject).toBe("Test Deen-এ স্বাগতম: আপনার ইমেইল যাচাই করুন");
    expect(email.html).toContain("ইমেইল যাচাই করুন");
    expect(email.html).toContain("২৪ ঘণ্টা");
    expect(email.html).toContain("new@example.com");
  });

  it("links to the start page of the configured site otherwise", () => {
    const email = welcomeEmail(
      { email: "new@example.com", name: "Aisha" },
      { ...site, locale: "en" },
    );

    expect(email.subject).toBe("Welcome to Test Deen");
    expect(email.html).toContain('href="https://deen.example.org/"');
    expect(email.html).toContain("Start asking");
    expect(email.text).toContain("- Ask any question in Bangla, English or Banglish.");
  });
});
