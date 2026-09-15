import { ADMIN_CONFIG, EMAIL_CONFIG } from "@/config/site";
import type { StaffRole } from "@/lib/admin/roles";
import {
  appLink,
  emailContext,
  fill,
  type EmailContextOverrides,
  type EmailLocale,
} from "@/lib/email/templates/context";
import {
  escapeHtml,
  renderEmail,
  type EmailBlock,
  type RenderedEmail,
} from "@/lib/email/templates/layout";

export type StaffEmailKind = "created" | "reset";

export interface StaffAccountEmailData {
  kind: StaffEmailKind;
  email: string;
  name?: string;
  password: string;
  categoryName: string;
  role?: StaffRole;
  loginUrl?: string;
  accountUrl?: string;
}

export const STAFF_ACCOUNT_PATH = `${ADMIN_CONFIG.paths.dashboard}/account`;

const PASSWORD_MARKER = "%%STAFF_PASSWORD_BLOCK%%";

const ROLE_NAMES: Record<EmailLocale, Record<StaffRole, string>> = {
  bn: { moderator: "মডারেটর", scholar: "আলেম" },
  en: { moderator: "Moderator", scholar: "Scholar" },
};

export const STAFF_ROLE_ABILITIES: Record<EmailLocale, Record<StaffRole, readonly string[]>> = {
  bn: {
    moderator: [
      "সাইট ও AI-এর কার্যক্রম পর্যবেক্ষণ করা",
      "সাইট কনটেন্ট ও AI সেটিংস ব্যবস্থাপনা করা",
      "রক্ষণাবেক্ষণের কাজ চালানো",
      "AI উত্তরের রিভিউ ও মানুষের প্রশ্ন দেখা",
    ],
    scholar: [
      "AI-এর দেওয়া উত্তর রিভিউ ও সংশোধন করা",
      "মানুষের পাঠানো প্রশ্নের উত্তর দেওয়া",
      "মাসআলা ও ফতোয়া লেখা",
    ],
  },
  en: {
    moderator: [
      "Monitor the site and AI activity",
      "Manage site content and AI settings",
      "Run maintenance tasks",
      "View AI answer reviews and questions people send",
    ],
    scholar: [
      "Review and correct answers written by the AI",
      "Answer questions people send",
      "Write masail and fatwas",
    ],
  },
};

const COPY = {
  bn: {
    subject: {
      created: "{appName}: আপনার স্টাফ অ্যাকাউন্ট তৈরি হয়েছে",
      reset: "{appName}: অ্যাডমিন আপনার পাসওয়ার্ড রিসেট করেছেন",
    },
    preheader: {
      created: "লগইনের তথ্য ভেতরে আছে। প্রথম লগইনের পরপরই পাসওয়ার্ড বদলে নিন।",
      reset: "নতুন অস্থায়ী পাসওয়ার্ড দিয়ে লগইন করে সঙ্গে সঙ্গে পাসওয়ার্ড বদলে নিন।",
    },
    heading: {
      created: "{appName} পরিচালনা প্যানেলে আপনাকে স্বাগতম",
      reset: "আপনার পাসওয়ার্ড রিসেট করা হয়েছে",
    },
    greeting: "আসসালামু আলাইকুম, {name}",
    greetingAnonymous: "আসসালামু আলাইকুম,",
    intro: {
      created:
        '{appName}-এর অ্যাডমিন আপনার জন্য একটি অ্যাকাউন্ট তৈরি করেছেন। আপনাকে "{categoryName}" ক্যাটাগরিতে যুক্ত করা হয়েছে।',
      reset:
        "{appName}-এর অ্যাডমিন আপনার অ্যাকাউন্টের ({email}) পাসওয়ার্ড রিসেট করেছেন। আগের পাসওয়ার্ড আর কাজ করবে না এবং সব ডিভাইস থেকে আপনাকে লগআউট করা হয়েছে।",
    },
    detailsTitle: "লগইনের তথ্য",
    loginEmail: "লগইন ইমেইল",
    category: "ক্যাটাগরি",
    role: "ভূমিকা",
    passwordLabel: {
      created: "অস্থায়ী পাসওয়ার্ড",
      reset: "নতুন অস্থায়ী পাসওয়ার্ড",
    },
    passwordHint: "হুবহু লিখুন বা কপি করুন; বড় ও ছোট হাতের অক্ষর আলাদা ধরা হয়।",
    button: "লগইন করুন",
    changeNow:
      "প্রথমবার লগইন করার পরপরই অ্যাকাউন্ট পাতায় গিয়ে এই পাসওয়ার্ড বদলে নিজের একটি শক্তিশালী পাসওয়ার্ড দিন। এই পাসওয়ার্ডটি অ্যাডমিন দেখেছেন, তাই এটি দীর্ঘদিন রাখা নিরাপদ নয়।",
    changeLink: "পাসওয়ার্ড বদলানোর পাতা:",
    abilitiesTitle: "আপনার ভূমিকায় যা করতে পারবেন",
    securityTitle: "নিরাপত্তার জন্য",
    security: [
      "পাসওয়ার্ড কারও সাথে শেয়ার করবেন না, পরিচিত কারও সাথেও নয়।",
      "{appName}-এর অ্যাডমিন বা কেউ কখনো ইমেইল, ফোন বা মেসেজে আপনার পাসওয়ার্ড চাইবে না।",
      "অন্যের ডিভাইসে কাজ শেষে অবশ্যই লগআউট করুন।",
      "পাসওয়ার্ড বদলানোর পর এই ইমেইলটি মুছে ফেলুন।",
    ],
    support:
      "কোনো সমস্যা হলে, অথবা এই অ্যাকাউন্ট সম্পর্কে আপনি না জানলে, {supportEmail} ঠিকানায় জানান।",
    fallback: "বাটন কাজ না করলে নিচের লিংকটি কপি করে ব্রাউজারে খুলুন:",
  },
  en: {
    subject: {
      created: "{appName}: Your staff account is ready",
      reset: "{appName}: An admin reset your password",
    },
    preheader: {
      created:
        "Your sign-in details are inside. Change your password right after you first sign in.",
      reset: "Sign in with the new temporary password and change it right away.",
    },
    heading: {
      created: "Welcome to the {appName} admin panel",
      reset: "Your password has been reset",
    },
    greeting: "Assalamu alaikum, {name}",
    greetingAnonymous: "Assalamu alaikum,",
    intro: {
      created:
        'An {appName} admin has created an account for you in the "{categoryName}" category.',
      reset:
        "An {appName} admin has reset the password for your account ({email}). Your old password no longer works and you have been signed out on every device.",
    },
    detailsTitle: "Sign-in details",
    loginEmail: "Sign-in email",
    category: "Category",
    role: "Role",
    passwordLabel: {
      created: "Temporary password",
      reset: "New temporary password",
    },
    passwordHint: "Type or copy it exactly; letters are case sensitive.",
    button: "Sign in",
    changeNow:
      "Right after your first sign-in, open your account page and replace this password with a strong one of your own. The admin has seen this password, so it is not safe to keep.",
    changeLink: "Change your password here:",
    abilitiesTitle: "What your role can do",
    securityTitle: "Stay safe",
    security: [
      "Never share your password with anyone, not even someone you know.",
      "No {appName} admin or anyone else will ever ask for your password by email, phone or message.",
      "Always sign out when you finish on someone else's device.",
      "Delete this email after you change your password.",
    ],
    support:
      "If something is wrong, or you do not recognise this account, write to {supportEmail}.",
    fallback: "If the button does not work, copy and paste this link into your browser:",
  },
};

function passwordBlockHtml(label: string, hint: string, password: string): string {
  const { colors } = EMAIL_CONFIG;
  return `<div style="margin:0 0 20px;padding:16px;background:${colors.notice};border:1px dashed ${colors.button};border-radius:8px;">
<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${colors.text};">${escapeHtml(label)}</p>
<p style="margin:0 0 8px;padding:12px 14px;background:${colors.card};border:1px solid ${colors.border};border-radius:6px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace;font-size:20px;font-weight:700;line-height:1.4;letter-spacing:1px;color:${colors.text};word-break:break-all;">${escapeHtml(password)}</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:${colors.muted};">${escapeHtml(hint)}</p>
</div>`;
}

export function staffAccountEmail(
  data: StaffAccountEmailData,
  overrides: EmailContextOverrides = {},
): RenderedEmail {
  const context = emailContext(overrides);
  const copy = COPY[context.locale];
  const kind = data.kind;
  const values = {
    appName: context.appName,
    email: data.email,
    name: data.name?.trim() ?? "",
    categoryName: data.categoryName,
    supportEmail: context.supportEmail,
  };
  const loginUrl = data.loginUrl ?? appLink(context, ADMIN_CONFIG.paths.login);
  const accountUrl = data.accountUrl ?? appLink(context, STAFF_ACCOUNT_PATH);
  const abilities = data.role ? STAFF_ROLE_ABILITIES[context.locale][data.role] : [];

  const rows = [
    { label: copy.loginEmail, value: data.email },
    { label: copy.category, value: data.categoryName },
    ...(data.role ? [{ label: copy.role, value: ROLE_NAMES[context.locale][data.role] }] : []),
  ];

  const blocks: EmailBlock[] = [
    { kind: "heading", text: fill(copy.heading[kind], values) },
    {
      kind: "paragraph",
      text: values.name ? fill(copy.greeting, values) : copy.greetingAnonymous,
    },
    { kind: "paragraph", text: fill(copy.intro[kind], values) },
    { kind: "details", title: copy.detailsTitle, rows },
    { kind: "paragraph", text: PASSWORD_MARKER },
    { kind: "button", label: copy.button, url: loginUrl },
    { kind: "notice", text: copy.changeNow },
    { kind: "link", intro: copy.changeLink, url: accountUrl },
    ...(abilities.length > 0
      ? ([{ kind: "list", title: copy.abilitiesTitle, items: abilities }] satisfies EmailBlock[])
      : []),
    {
      kind: "list",
      title: copy.securityTitle,
      items: copy.security.map((item) => fill(item, values)),
    },
    { kind: "paragraph", text: fill(copy.support, values), muted: true },
    { kind: "link", intro: copy.fallback, url: loginUrl },
  ];

  const rendered = renderEmail(context, {
    subject: fill(copy.subject[kind], values),
    preheader: fill(copy.preheader[kind], values),
    recipientEmail: data.email,
    blocks,
  });

  const label = copy.passwordLabel[kind];
  return {
    ...rendered,
    html: rendered.html.replace(new RegExp(`<p[^>]*>${PASSWORD_MARKER}</p>`), () =>
      passwordBlockHtml(label, copy.passwordHint, data.password),
    ),
    text: rendered.text.replace(PASSWORD_MARKER, () => `${label}: ${data.password}`),
  };
}
