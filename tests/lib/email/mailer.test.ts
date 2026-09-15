import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("mailtrap", () => ({
  MailtrapClient: class {
    send = send;
  },
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    send.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing without a token", async () => {
    vi.stubEnv("MAILTRAP_API_TOKEN", "");
    const { isEmailConfigured, sendEmail } = await import("@/lib/email/mailer");

    expect(isEmailConfigured()).toBe(false);
    expect((await sendEmail({ to: "a@example.com", subject: "s", text: "t" })).sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends from the configured sender with the category", async () => {
    vi.stubEnv("MAILTRAP_API_TOKEN", "test-token");
    send.mockResolvedValue({ success: true, message_ids: ["m1"] });
    const { sendEmail } = await import("@/lib/email/mailer");
    const { EMAIL_CONFIG } = await import("@/config/site");

    const result = await sendEmail({
      to: ["a@example.com", "b@example.com"],
      subject: "Subject",
      text: "Body",
      category: "Integration Test",
    });

    expect(result).toEqual({ sent: true, messageIds: ["m1"] });
    expect(send).toHaveBeenCalledWith({
      from: { email: EMAIL_CONFIG.sender.email, name: EMAIL_CONFIG.sender.name },
      to: [{ email: "a@example.com" }, { email: "b@example.com" }],
      subject: "Subject",
      text: "Body",
      category: "Integration Test",
    });
  });

  it("reports a failure instead of throwing", async () => {
    vi.stubEnv("MAILTRAP_API_TOKEN", "test-token");
    send.mockRejectedValue(new Error("Unauthorized"));
    const { sendEmail } = await import("@/lib/email/mailer");

    const result = await sendEmail({ to: "a@example.com", subject: "s", text: "t" });
    expect(result.sent).toBe(false);
    expect(result.error).toContain("Unauthorized");
  });
});
