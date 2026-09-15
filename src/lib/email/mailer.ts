import { MailtrapClient } from "mailtrap";
import { EMAIL_CONFIG } from "@/config/site";
import { getEmailEnv } from "@/lib/utils/env";
import { logger } from "@/lib/utils/logger";

export interface OutgoingEmail {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  category?: string;
}

export interface EmailResult {
  sent: boolean;
  messageIds: string[];
  error?: string;
}

let client: MailtrapClient | null = null;

export function senderAddress(): { email: string; name: string } {
  const env = getEmailEnv();
  return {
    email: env.EMAIL_FROM ?? EMAIL_CONFIG.sender.email,
    name: env.EMAIL_FROM_NAME ?? EMAIL_CONFIG.sender.name,
  };
}

export async function sendRenderedEmail(
  to: string | string[],
  email: { subject: string; text: string; html: string },
  category?: string,
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    ...(category ? { category } : {}),
  });
}

export function isEmailConfigured(): boolean {
  return Boolean(getEmailEnv().MAILTRAP_API_TOKEN);
}

function mailtrap(): MailtrapClient | null {
  const token = getEmailEnv().MAILTRAP_API_TOKEN;
  if (!token) return null;
  client ??= new MailtrapClient({ token });
  return client;
}

export async function sendEmail(email: OutgoingEmail): Promise<EmailResult> {
  const transport = mailtrap();
  if (!transport) return { sent: false, messageIds: [], error: "MAILTRAP_API_TOKEN is not set" };

  const recipients = (Array.isArray(email.to) ? email.to : [email.to]).map((address) => ({
    email: address,
  }));

  try {
    const response = await transport.send({
      from: senderAddress(),
      to: recipients,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.category ? { category: email.category } : {}),
    });
    logger.info("Email sent through Mailtrap", {
      category: email.category,
      recipients: recipients.length,
      messageIds: response.message_ids.join(", "),
    });
    return { sent: true, messageIds: response.message_ids };
  } catch (error) {
    const message = String(error).slice(0, 300);
    logger.warn("Email sending failed", { category: email.category, error: message });
    return { sent: false, messageIds: [], error: message };
  }
}
