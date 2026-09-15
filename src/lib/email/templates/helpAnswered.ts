import {
  emailContext,
  fill,
  formatDateTime,
  type EmailContextOverrides,
} from "@/lib/email/templates/context";
import { renderEmail, type EmailBlock, type RenderedEmail } from "@/lib/email/templates/layout";

export interface HelpAnsweredEmailData {
  email: string;
  name?: string;
  question: string;
  scholarName: string;
  scholarCategory: string;
  trackUrl: string;
  answeredAt?: Date;
  masalaUrl?: string;
}

const QUESTION_EXCERPT_CHARS = 280;

const COPY = {
  bn: {
    subject: "{appName}: আপনার প্রশ্নের উত্তর দিয়েছেন {category} {scholar}",
    preheader: "আপনার পাঠানো প্রশ্নের উত্তর তৈরি হয়েছে। লিংকে গিয়ে পুরো উত্তর ও দলিল দেখুন।",
    heading: "আপনার প্রশ্নের উত্তর এসেছে",
    greeting: "আসসালামু আলাইকুম, {name}",
    greetingAnonymous: "আসসালামু আলাইকুম,",
    intro:
      "{appName}-এ আলেমদের কাছে পাঠানো আপনার প্রশ্নের উত্তর দিয়েছেন {category} {scholar}। পুরো উত্তর ও দলিল দেখতে নিচের বাটনে ক্লিক করুন।",
    detailsTitle: "প্রশ্নের তথ্য",
    question: "প্রশ্ন",
    answeredBy: "উত্তর দিয়েছেন",
    answeredAt: "সময়",
    button: "উত্তর দেখুন",
    masala: "উত্তরটি মাসআলা হিসেবেও প্রকাশ করা হয়েছে, যাতে অন্যরাও উপকৃত হন।",
    privacy: "এই লিংক দিয়ে আপনার প্রশ্ন ও উত্তর দেখা যায়, তাই লিংকটি কারও সাথে শেয়ার করবেন না।",
    disclaimer:
      "ব্যক্তিগত বা জটিল বিষয়ে প্রয়োজনে সরাসরি একজন নির্ভরযোগ্য মুফতির সাথে পরামর্শ করুন।",
    notYou:
      "আপনি এই প্রশ্ন না পাঠিয়ে থাকলে ইমেইলটি উপেক্ষা করুন অথবা {supportEmail} ঠিকানায় জানান।",
    fallback: "বাটন কাজ না করলে নিচের লিংকটি কপি করে ব্রাউজারে খুলুন:",
  },
  en: {
    subject: "{appName}: {category} {scholar} answered your question",
    preheader:
      "Your question has been answered. Open the link to read the answer and its evidence.",
    heading: "Your question has been answered",
    greeting: "Assalamu alaikum, {name}",
    greetingAnonymous: "Assalamu alaikum,",
    intro:
      "{category} {scholar} has answered the question you sent to the scholars on {appName}. Use the button below to read the full answer with its evidence.",
    detailsTitle: "Question details",
    question: "Question",
    answeredBy: "Answered by",
    answeredAt: "Time",
    button: "Read the answer",
    masala: "The answer has also been published as a masala so that others can benefit.",
    privacy:
      "Anyone with this link can read your question and its answer, so please do not share it.",
    disclaimer:
      "For personal or complex matters, please also consult a trusted mufti directly when needed.",
    notYou: "If you did not send this question, ignore this email or contact {supportEmail}.",
    fallback: "If the button does not work, copy and paste this link into your browser:",
  },
};

function shorten(text: string): string {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > QUESTION_EXCERPT_CHARS
    ? `${plain.slice(0, QUESTION_EXCERPT_CHARS).trimEnd()}…`
    : plain;
}

export function helpAnsweredEmail(
  data: HelpAnsweredEmailData,
  overrides: EmailContextOverrides = {},
): RenderedEmail {
  const context = emailContext(overrides);
  const copy = COPY[context.locale];
  const values = {
    appName: context.appName,
    name: data.name?.trim() ?? "",
    scholar: data.scholarName.trim(),
    category: data.scholarCategory.trim(),
    supportEmail: context.supportEmail,
  };

  const blocks: EmailBlock[] = [
    { kind: "heading", text: copy.heading },
    {
      kind: "paragraph",
      text: values.name ? fill(copy.greeting, values) : copy.greetingAnonymous,
    },
    { kind: "paragraph", text: fill(copy.intro, values) },
    {
      kind: "details",
      title: copy.detailsTitle,
      rows: [
        { label: copy.question, value: shorten(data.question) },
        { label: copy.answeredBy, value: `${values.category} ${values.scholar}`.trim() },
        { label: copy.answeredAt, value: formatDateTime(context, data.answeredAt ?? context.now) },
      ],
    },
    { kind: "button", label: copy.button, url: data.trackUrl },
    ...(data.masalaUrl
      ? ([{ kind: "link", intro: copy.masala, url: data.masalaUrl }] satisfies EmailBlock[])
      : []),
    { kind: "notice", text: copy.privacy },
    { kind: "paragraph", text: copy.disclaimer, muted: true },
    { kind: "paragraph", text: fill(copy.notYou, values), muted: true },
    { kind: "link", intro: copy.fallback, url: data.trackUrl },
  ];

  return renderEmail(context, {
    subject: fill(copy.subject, values),
    preheader: copy.preheader,
    recipientEmail: data.email,
    blocks,
  });
}
