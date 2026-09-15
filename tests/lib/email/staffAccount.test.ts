import { describe, expect, it } from "vitest";
import { staffAccountEmail } from "@/lib/email/templates/staffAccount";

const site = {
  appName: "Test Deen",
  appUrl: "https://deen.example.org/",
  supportEmail: "help@deen.example.org",
  now: new Date("2026-09-15T03:30:00Z"),
};

const data = {
  kind: "created" as const,
  email: "mufti@example.com",
  name: "মুফতি আব্দুল্লাহ",
  password: "Ab<c>&d$1'x",
  categoryName: "মুফতি",
  role: "scholar" as const,
};

describe("staffAccountEmail", () => {
  it("puts the login details and an escaped password block into a new account email", () => {
    const email = staffAccountEmail(data, site);

    expect(email.subject).toBe("Test Deen: আপনার স্টাফ অ্যাকাউন্ট তৈরি হয়েছে");
    expect(email.html).toContain("আসসালামু আলাইকুম, মুফতি আব্দুল্লাহ");
    expect(email.html).toContain("মুফতি");
    expect(email.html).toContain("mufti@example.com");
    expect(email.html).toContain("Ab&lt;c&gt;&amp;d$1&#39;x");
    expect(email.html).not.toContain("Ab<c>");
    expect(email.html).toContain("monospace");
    expect(email.html).not.toContain("%%STAFF_PASSWORD_BLOCK%%");
    expect(email.html).toContain('href="https://deen.example.org/admin/login"');
    expect(email.html).toContain("https://deen.example.org/admin/account");
    expect(email.html).toContain("মাসআলা ও ফতোয়া লেখা");
    expect(email.html).toContain("help@deen.example.org");
    expect(email.preheader).not.toContain(data.password);
    expect(email.subject).not.toContain(data.password);
    expect(email.text).toContain("অস্থায়ী পাসওয়ার্ড: Ab<c>&d$1'x");
    expect(email.text).not.toContain("%%STAFF_PASSWORD_BLOCK%%");
    expect(email.html).not.toContain("—");
    expect(email.text).not.toContain("—");
  });

  it("uses reset wording and the moderator abilities", () => {
    const email = staffAccountEmail(
      { ...data, kind: "reset", role: "moderator", categoryName: "মডারেটর" },
      site,
    );

    expect(email.subject).toBe("Test Deen: অ্যাডমিন আপনার পাসওয়ার্ড রিসেট করেছেন");
    expect(email.html).toContain("নতুন অস্থায়ী পাসওয়ার্ড");
    expect(email.html).toContain("রক্ষণাবেক্ষণের কাজ চালানো");
    expect(email.html).not.toContain("মাসআলা ও ফতোয়া লেখা");
  });

  it("writes English for an English reader", () => {
    const email = staffAccountEmail(
      { ...data, name: undefined, password: "Plain#Pass9" },
      { ...site, locale: "en" },
    );

    expect(email.subject).toBe("Test Deen: Your staff account is ready");
    expect(email.html).toContain("Assalamu alaikum,");
    expect(email.html).toContain("Plain#Pass9");
    expect(email.html).toContain("Write masail and fatwas");
    expect(email.text).toContain("Temporary password: Plain#Pass9");
  });
});
