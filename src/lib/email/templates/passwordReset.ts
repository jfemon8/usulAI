import { EMAIL_CONFIG } from "@/config/site";
import {
  emailContext,
  fill,
  formatCount,
  formatDateTime,
  type EmailContextOverrides,
} from "@/lib/email/templates/context";
import { renderEmail, type EmailBlock, type RenderedEmail } from "@/lib/email/templates/layout";

export interface PasswordResetEmailData {
  email: string;
  name?: string;
  resetUrl: string;
  expiresInMinutes?: number;
  requestedAt?: Date;
  ipAddress?: string;
  device?: string;
  location?: string;
}

const COPY = {
  bn: {
    subject: "{appName}: আপনার পাসওয়ার্ড রিসেট করুন",
    preheader: "পাসওয়ার্ড রিসেটের লিংকটি {minutes} মিনিট কার্যকর থাকবে।",
    heading: "পাসওয়ার্ড রিসেটের অনুরোধ",
    greeting: "আসসালামু আলাইকুম, {name}",
    greetingAnonymous: "আসসালামু আলাইকুম,",
    intro:
      "আপনার {appName} অ্যাকাউন্টের ({email}) পাসওয়ার্ড রিসেট করার একটি অনুরোধ আমরা পেয়েছি। নতুন পাসওয়ার্ড সেট করতে নিচের বাটনে ক্লিক করুন।",
    button: "নতুন পাসওয়ার্ড সেট করুন",
    expiry: "নিরাপত্তার জন্য লিংকটি {minutes} মিনিট কার্যকর থাকবে এবং একবারই ব্যবহার করা যাবে।",
    detailsTitle: "অনুরোধের তথ্য",
    requestedAt: "সময়",
    ipAddress: "আইপি ঠিকানা",
    device: "ডিভাইস",
    location: "অবস্থান",
    ignore:
      "আপনি এই অনুরোধ না করে থাকলে ইমেইলটি উপেক্ষা করুন; আপনার পাসওয়ার্ড অপরিবর্তিত থাকবে। কেউ আপনার অ্যাকাউন্টে ঢোকার চেষ্টা করছে মনে হলে {supportEmail} ঠিকানায় জানান।",
    neverShare:
      "এই লিংক কারও সাথে শেয়ার করবেন না। {appName} কখনো ইমেইলে আপনার পাসওয়ার্ড চাইবে না।",
    fallback: "বাটন কাজ না করলে নিচের লিংকটি কপি করে ব্রাউজারে খুলুন:",
  },
  en: {
    subject: "{appName}: Reset your password",
    preheader: "Your password reset link is valid for {minutes} minutes.",
    heading: "Password reset request",
    greeting: "Assalamu alaikum, {name}",
    greetingAnonymous: "Assalamu alaikum,",
    intro:
      "We received a request to reset the password for your {appName} account ({email}). Click the button below to choose a new password.",
    button: "Set a new password",
    expiry:
      "For your security, this link is valid for {minutes} minutes and can be used only once.",
    detailsTitle: "Request details",
    requestedAt: "Time",
    ipAddress: "IP address",
    device: "Device",
    location: "Location",
    ignore:
      "If you did not request this, you can ignore this email and your password will stay the same. If you think someone is trying to access your account, contact {supportEmail}.",
    neverShare:
      "Do not share this link with anyone. {appName} will never ask for your password by email.",
    fallback: "If the button does not work, copy and paste this link into your browser:",
  },
};

export function passwordResetEmail(
  data: PasswordResetEmailData,
  overrides: EmailContextOverrides = {},
): RenderedEmail {
  const context = emailContext(overrides);
  const copy = COPY[context.locale];
  const minutes = formatCount(context, data.expiresInMinutes ?? EMAIL_CONFIG.passwordResetMinutes);
  const values = {
    appName: context.appName,
    email: data.email,
    name: data.name?.trim() ?? "",
    minutes,
    supportEmail: context.supportEmail,
  };

  const rows = [
    { label: copy.requestedAt, value: formatDateTime(context, data.requestedAt ?? context.now) },
    ...(data.ipAddress ? [{ label: copy.ipAddress, value: data.ipAddress }] : []),
    ...(data.device ? [{ label: copy.device, value: data.device }] : []),
    ...(data.location ? [{ label: copy.location, value: data.location }] : []),
  ];

  const blocks: EmailBlock[] = [
    { kind: "heading", text: copy.heading },
    {
      kind: "paragraph",
      text: values.name ? fill(copy.greeting, values) : copy.greetingAnonymous,
    },
    { kind: "paragraph", text: fill(copy.intro, values) },
    { kind: "button", label: copy.button, url: data.resetUrl },
    { kind: "notice", text: fill(copy.expiry, values) },
    { kind: "details", title: copy.detailsTitle, rows },
    { kind: "paragraph", text: fill(copy.ignore, values) },
    { kind: "paragraph", text: fill(copy.neverShare, values), muted: true },
    { kind: "link", intro: copy.fallback, url: data.resetUrl },
  ];

  return renderEmail(context, {
    subject: fill(copy.subject, values),
    preheader: fill(copy.preheader, values),
    recipientEmail: data.email,
    blocks,
  });
}
