export type AnnouncementTone = "info" | "warning";

export interface AnnouncementLink {
  label: string;
  url: string;
}

export interface Announcement {
  enabled: boolean;
  text: string;
  tone: AnnouncementTone;
  link?: AnnouncementLink;
}

export interface HomeContent {
  bismillah: string;
  greeting: string;
  subtitle: string;
  suggestions: string[];
  announcement: Announcement;
}

export interface AiSettings {
  extraInstructions: string;
  disabledModels: string[];
  verifiedAnswersEnabled: boolean;
}

export interface DomainSettings {
  url: string;
  googleVerification: string;
}

export const SITE_CONTENT_LIMITS = {
  bismillahChars: 200,
  greetingChars: 200,
  subtitleChars: 600,
  suggestionChars: 200,
  maxSuggestions: 200,
  announcementChars: 300,
  linkLabelChars: 60,
  linkUrlChars: 500,
  extraInstructionsChars: 4000,
  maxDisabledModels: 50,
  modelIdChars: 200,
  domainChars: 200,
  loadTimeoutMs: 3000,
  aiSettingsCacheMs: 60_000,
} as const;

export const DEFAULT_DOMAIN_SETTINGS: DomainSettings = { url: "", googleVerification: "" };

export function normalizeVerificationCode(value: string): string {
  const trimmed = value.trim().replace(/^<meta[^>]*content=["']([^"']+)["'][^>]*>$/i, "$1");
  return /^[A-Za-z0-9_-]{1,120}$/.test(trimmed) ? trimmed : "";
}

export function normalizeDomainUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > SITE_CONTENT_LIMITS.domainChars) return null;

  let parsed: URL;
  try {
    parsed = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (parsed.username || parsed.password) return null;
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;

  const host = parsed.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return null;

  if (!local) {
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;
    const tld = host.split(".").at(-1) ?? "";
    if (tld.length < 2 || /^\d+$/.test(tld)) return null;
  }

  return `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ""}`;
}

export function mergeDomainSettings(stored: unknown): DomainSettings {
  if (!isRecord(stored)) return { ...DEFAULT_DOMAIN_SETTINGS };
  return {
    url: typeof stored.url === "string" ? (normalizeDomainUrl(stored.url) ?? "") : "",
    googleVerification:
      typeof stored.googleVerification === "string"
        ? normalizeVerificationCode(stored.googleVerification)
        : "",
  };
}

export const DEFAULT_QUESTION_POOL: readonly string[] = [
  "নামাজের শর্ত কী কী?",
  "যাকাত কাদের উপর ফরজ?",
  "রোজা ভেঙে গেলে করণীয় কী?",
  "অজু ভঙ্গের কারণগুলো কী কী?",
  "তাহাজ্জুদ নামাজের ফজিলত কী?",
  "সুদ সম্পর্কে কুরআনে কী নির্দেশনা এসেছে?",
  "মা-বাবার সাথে আচরণ নিয়ে ইসলাম কী বলে?",
  "জুমার দিনের আমলগুলো কী কী?",
  "হজ কার উপর ফরজ হয়?",
  "গীবত কাকে বলে, এর বিধান কী?",
  "তাওবার শর্তগুলো কী কী?",
  "প্রতিবেশীর হক সম্পর্কে হাদিসে কী আছে?",
  "ধৈর্য সম্পর্কে কুরআন কী বলে?",
  "ইয়াতিমের অধিকার নিয়ে ইসলাম কী বলে?",
  "ঋণ পরিশোধ নিয়ে শরীয়তের বিধান কী?",
  "মিথ্যা বলার ব্যাপারে হাদিসে কী সতর্কতা আছে?",
  "ফজরের নামাজের ফজিলত কী?",
  "জামাআতে নামাজ পড়ার গুরুত্ব কী?",
  "সফরে নামাজ কসর করার নিয়ম কী?",
  "তায়াম্মুম কখন করা যায়?",
  "ফরজ গোসল কখন ওয়াজিব হয়?",
  "রমযানের শেষ দশকের আমল কী?",
  "লাইলাতুল কদরের ফজিলত কী?",
  "সাদাকাতুল ফিতর কাদের উপর ওয়াজিব?",
  "কুরবানি কার উপর ওয়াজিব?",
  "উমরা করার ফজিলত কী?",
  "ইতিকাফের বিধান কী?",
  "দুআ কবুলের সময়গুলো কী কী?",
  "সকাল-সন্ধ্যার যিকিরের ফজিলত কী?",
  "দরুদ পাঠের ফজিলত কী?",
  "কুরআন তিলাওয়াতের ফজিলত সম্পর্কে হাদিসে কী আছে?",
  "সূরা ফাতিহার গুরুত্ব কী?",
  "আয়াতুল কুরসির ফজিলত কী?",
  "শিরক কাকে বলে, এর পরিণাম কী?",
  "তাকদিরে বিশ্বাস সম্পর্কে ইসলাম কী বলে?",
  "কিয়ামতের আলামত সম্পর্কে হাদিসে কী এসেছে?",
  "জান্নাতে যাওয়ার আমলগুলো কী কী?",
  "অহংকার সম্পর্কে কুরআন কী বলে?",
  "হিংসা থেকে বাঁচার উপায় কী?",
  "রাগ নিয়ন্ত্রণ সম্পর্কে হাদিসে কী আছে?",
  "আত্মীয়তার সম্পর্ক ছিন্ন করার পরিণাম কী?",
  "স্ত্রীর প্রতি স্বামীর দায়িত্ব কী?",
  "সন্তানের প্রতি বাবা-মায়ের দায়িত্ব কী?",
  "বিয়ের সুন্নত পদ্ধতি কী?",
  "মোহরানা সম্পর্কে কুরআন কী বলে?",
  "তালাকের বিধান কী?",
  "পর্দা সম্পর্কে কুরআনে কী নির্দেশ এসেছে?",
  "মদ ও জুয়া সম্পর্কে কুরআন কী বলে?",
  "ব্যবসায় সততা সম্পর্কে হাদিসে কী আছে?",
  "ওজনে কম দেওয়ার শাস্তি কী?",
  "ঘুষ দেওয়া-নেওয়ার বিধান কী?",
  "অন্যের সম্পদ অন্যায়ভাবে খাওয়ার পরিণাম কী?",
  "মিসকিনকে খাওয়ানোর ফজিলত কী?",
  "অসুস্থ ব্যক্তিকে দেখতে যাওয়ার ফজিলত কী?",
  "জানাযার নামাজের ফজিলত কী?",
  "কবর জিয়ারতের বিধান কী?",
  "মৃত ব্যক্তির জন্য কোন আমল কাজে আসে?",
  "খাবার খাওয়ার সুন্নতগুলো কী কী?",
  "ঘুমানোর আগের সুন্নত আমল কী?",
  "মেহমানদারির গুরুত্ব কী?",
  "সৎকাজের আদেশ ও অসৎকাজে নিষেধের গুরুত্ব কী?",
  "শুকরিয়া আদায় সম্পর্কে কুরআন কী বলে?",
  "বিপদে ধৈর্য ধরার পুরস্কার কী?",
  "জ্ঞান অর্জনের ফজিলত সম্পর্কে হাদিসে কী আছে?",
  "প্রতিশ্রুতি রক্ষা সম্পর্কে কুরআন কী বলে?",
  "জিহ্বার হেফাজত সম্পর্কে হাদিসে কী আছে?",
  "নিয়তের গুরুত্ব সম্পর্কে হাদিস কী?",
];

export const DEFAULT_HOME_CONTENT: HomeContent = {
  bismillah: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
  greeting: "আসসালামু আলাইকুম, কী জানতে চান?",
  subtitle:
    "আপনার প্রশ্নের উত্তর আসবে শুধুমাত্র কুরআন, হাদিস, ইজমা, কিয়াস ও সীরাতের দলিল থেকে, ইং-শা-আল্লাহ।",
  suggestions: [...DEFAULT_QUESTION_POOL],
  announcement: { enabled: false, text: "", tone: "info" },
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  extraInstructions: "",
  disabledModels: [],
  verifiedAnswersEnabled: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, max: number): string {
  return typeof value === "string" && value.length <= max ? value.trim() : fallback;
}

export function safeLinkUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > SITE_CONTENT_LIMITS.linkUrlChars) return null;
  if (/^\/(?![/\\])/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function cleanSuggestions(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const question = value.replace(/\s+/g, " ").trim();
    if (question.length === 0 || question.length > SITE_CONTENT_LIMITS.suggestionChars) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(question);
    if (result.length >= SITE_CONTENT_LIMITS.maxSuggestions) break;
  }
  return result;
}

export function splitBulkQuestions(pasted: string): string[] {
  return pasted
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*\u2022]|\d+[.)]|[\u09E6-\u09EF]+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function mergeAnnouncement(value: unknown): Announcement {
  const fallback = DEFAULT_HOME_CONTENT.announcement;
  if (!isRecord(value)) return { ...fallback };

  const announcementText = text(value.text, "", SITE_CONTENT_LIMITS.announcementChars);
  const announcement: Announcement = {
    enabled: value.enabled === true && announcementText.length > 0,
    text: announcementText,
    tone: value.tone === "warning" ? "warning" : "info",
  };

  if (isRecord(value.link)) {
    const url = typeof value.link.url === "string" ? safeLinkUrl(value.link.url) : null;
    const label = text(value.link.label, "", SITE_CONTENT_LIMITS.linkLabelChars);
    if (url && label) announcement.link = { label, url };
  }

  return announcement;
}

export function mergeHomeContent(stored: unknown): HomeContent {
  const defaults = DEFAULT_HOME_CONTENT;
  if (!isRecord(stored)) return { ...defaults, suggestions: [...defaults.suggestions] };

  const greeting = text(stored.greeting, defaults.greeting, SITE_CONTENT_LIMITS.greetingChars);
  return {
    bismillah: text(stored.bismillah, defaults.bismillah, SITE_CONTENT_LIMITS.bismillahChars),
    greeting: greeting.length > 0 ? greeting : defaults.greeting,
    subtitle: text(stored.subtitle, defaults.subtitle, SITE_CONTENT_LIMITS.subtitleChars),
    suggestions: Array.isArray(stored.suggestions)
      ? cleanSuggestions(stored.suggestions)
      : [...defaults.suggestions],
    announcement: mergeAnnouncement(stored.announcement),
  };
}

export function mergeAiSettings(stored: unknown): AiSettings {
  const defaults = DEFAULT_AI_SETTINGS;
  if (!isRecord(stored)) return { ...defaults, disabledModels: [] };

  const disabled = Array.isArray(stored.disabledModels)
    ? stored.disabledModels.filter(
        (model): model is string =>
          typeof model === "string" &&
          model.trim().length > 0 &&
          model.length <= SITE_CONTENT_LIMITS.modelIdChars,
      )
    : [];

  return {
    extraInstructions: text(
      stored.extraInstructions,
      defaults.extraInstructions,
      SITE_CONTENT_LIMITS.extraInstructionsChars,
    ),
    disabledModels: [...new Set(disabled.map((model) => model.trim()))].slice(
      0,
      SITE_CONTENT_LIMITS.maxDisabledModels,
    ),
    verifiedAnswersEnabled:
      typeof stored.verifiedAnswersEnabled === "boolean"
        ? stored.verifiedAnswersEnabled
        : defaults.verifiedAnswersEnabled,
  };
}

export function enabledModels<T extends { modelId: string }>(
  chain: readonly T[],
  disabledModels: readonly string[],
): T[] {
  if (disabledModels.length === 0) return [...chain];
  const disabled = new Set(disabledModels);
  const enabled = chain.filter((entry) => !disabled.has(entry.modelId));
  return enabled.length > 0 ? enabled : [...chain];
}
