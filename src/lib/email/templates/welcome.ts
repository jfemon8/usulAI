import { EMAIL_CONFIG } from "@/config/site";
import {
  appLink,
  emailContext,
  fill,
  formatCount,
  type EmailContextOverrides,
} from "@/lib/email/templates/context";
import { renderEmail, type EmailBlock, type RenderedEmail } from "@/lib/email/templates/layout";

export interface WelcomeEmailData {
  email: string;
  name?: string;
  verifyUrl?: string;
  expiresInHours?: number;
  startUrl?: string;
}

const COPY = {
  bn: {
    subjectVerify: "{appName}-এ স্বাগতম: আপনার ইমেইল যাচাই করুন",
    subject: "{appName}-এ স্বাগতম",
    preheaderVerify: "অ্যাকাউন্ট চালু করতে {hours} ঘণ্টার মধ্যে ইমেইল যাচাই করুন।",
    preheader: "আপনার অ্যাকাউন্ট তৈরি হয়েছে, এখনই প্রশ্ন করা শুরু করুন।",
    heading: "{appName}-এ আপনাকে স্বাগতম",
    greeting: "আসসালামু আলাইকুম, {name}",
    greetingAnonymous: "আসসালামু আলাইকুম,",
    created: "আপনার {appName} অ্যাকাউন্ট ({email}) সফলভাবে তৈরি হয়েছে।",
    summary: "{appName} {summary}",
    verifyPrompt: "অ্যাকাউন্টটি চালু করতে নিচের বাটনে ক্লিক করে আপনার ইমেইল ঠিকানা যাচাই করুন।",
    verifyButton: "ইমেইল যাচাই করুন",
    verifyExpiry: "যাচাইয়ের লিংকটি {hours} ঘণ্টা কার্যকর থাকবে।",
    startButton: "প্রশ্ন করা শুরু করুন",
    tipsTitle: "শুরু করার আগে",
    disclaimer:
      "{appName} দলিলভিত্তিক তথ্য দেয়, তবে গুরুত্বপূর্ণ ও ব্যক্তিগত মাসআলার জন্য সবসময় একজন যোগ্য আলেমের পরামর্শ নিন।",
    notYou:
      "আপনি এই অ্যাকাউন্ট তৈরি না করে থাকলে ইমেইলটি উপেক্ষা করুন অথবা {supportEmail} ঠিকানায় জানান।",
    fallback: "বাটন কাজ না করলে নিচের লিংকটি কপি করে ব্রাউজারে খুলুন:",
  },
  en: {
    subjectVerify: "Welcome to {appName}: please verify your email",
    subject: "Welcome to {appName}",
    preheaderVerify: "Verify your email within {hours} hours to activate your account.",
    preheader: "Your account is ready. Start asking your questions now.",
    heading: "Welcome to {appName}",
    greeting: "Assalamu alaikum, {name}",
    greetingAnonymous: "Assalamu alaikum,",
    created: "Your {appName} account ({email}) has been created.",
    summary: "{appName} {summary}",
    verifyPrompt:
      "Please verify your email address with the button below to activate your account.",
    verifyButton: "Verify email",
    verifyExpiry: "This verification link is valid for {hours} hours.",
    startButton: "Start asking",
    tipsTitle: "Before you begin",
    disclaimer:
      "{appName} gives evidence-based information, but always consult a qualified scholar for important and personal rulings.",
    notYou: "If you did not create this account, ignore this email or contact {supportEmail}.",
    fallback: "If the button does not work, copy and paste this link into your browser:",
  },
};

export function welcomeEmail(
  data: WelcomeEmailData,
  overrides: EmailContextOverrides = {},
): RenderedEmail {
  const context = emailContext(overrides);
  const copy = COPY[context.locale];
  const values = {
    appName: context.appName,
    email: data.email,
    name: data.name?.trim() ?? "",
    hours: formatCount(context, data.expiresInHours ?? EMAIL_CONFIG.verifyEmailHours),
    summary: context.summary,
    supportEmail: context.supportEmail,
  };
  const actionUrl = data.verifyUrl ?? data.startUrl ?? appLink(context, EMAIL_CONFIG.links.start);

  const blocks: EmailBlock[] = [
    { kind: "heading", text: fill(copy.heading, values) },
    {
      kind: "paragraph",
      text: values.name ? fill(copy.greeting, values) : copy.greetingAnonymous,
    },
    { kind: "paragraph", text: fill(copy.created, values) },
    { kind: "paragraph", text: fill(copy.summary, values) },
    ...(data.verifyUrl
      ? ([
          { kind: "paragraph", text: copy.verifyPrompt },
          { kind: "button", label: copy.verifyButton, url: actionUrl },
          { kind: "notice", text: fill(copy.verifyExpiry, values) },
        ] satisfies EmailBlock[])
      : ([{ kind: "button", label: copy.startButton, url: actionUrl }] satisfies EmailBlock[])),
    ...(context.tips.length > 0
      ? ([{ kind: "list", title: copy.tipsTitle, items: context.tips }] satisfies EmailBlock[])
      : []),
    { kind: "paragraph", text: fill(copy.disclaimer, values), muted: true },
    { kind: "paragraph", text: fill(copy.notYou, values), muted: true },
    { kind: "link", intro: copy.fallback, url: actionUrl },
  ];

  return renderEmail(context, {
    subject: fill(data.verifyUrl ? copy.subjectVerify : copy.subject, values),
    preheader: fill(data.verifyUrl ? copy.preheaderVerify : copy.preheader, values),
    recipientEmail: data.email,
    blocks,
  });
}
