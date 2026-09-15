import type { SourceType } from "@/types";

export const SOURCE_NAMES: Record<SourceType, string> = {
  quran: "কুরআন",
  hadith: "হাদিস",
  ijma: "ইজমা",
  qiyas: "কিয়াস",
  sirat: "সীরাত ও জীবনী",
  fiqh: "ফিকহ ও ফতোয়া",
};

const AREA_NAMES: Record<string, string> = {
  auth: "অ্যাকাউন্ট",
  corpus: "দলিল ভান্ডার",
  answers: "যাচাইকৃত উত্তর",
  notes: "কুরআনের নোট",
  site: "সাইট কনটেন্ট",
  ai: "AI সেটিংস",
  files: "ফাইল",
  database: "ডাটাবেস",
  staff: "স্টাফ অ্যাকাউন্ট",
  categories: "স্টাফ ক্যাটাগরি",
  reviews: "উত্তর রিভিউ",
  masail: "মাসআলা",
  help: "আলেমের কাছে প্রশ্ন",
  maintenance: "রক্ষণাবেক্ষণ",
};

const ACTION_NAMES: Record<string, string> = {
  "auth.login": "লগইন",
  "auth.logout": "লগআউট",
  "auth.reset-requested": "পাসওয়ার্ড রিসেটের অনুরোধ",
  "auth.password-reset": "রিসেট লিংকে পাসওয়ার্ড সেট",
  "auth.password-changed": "পাসওয়ার্ড পরিবর্তন",
  "auth.profile-updated": "নিজের তথ্য হালনাগাদ",
  "auth.sessions-revoked": "অন্য সব সেশন বন্ধ",
  "auth.session-revoked": "একটি সেশন বন্ধ",
  create: "তৈরি",
  update: "হালনাগাদ",
  delete: "মুছে ফেলা",
  insert: "যোগ",
  replace: "পরিবর্তন",
  "bulk-delete": "একসাথে মুছে ফেলা",
  upload: "আপলোড",
  rename: "নাম বা স্থান পরিবর্তন",
  tags: "ট্যাগ পরিবর্তন",
  "folder-create": "ফোল্ডার তৈরি",
  "folder-delete": "ফোল্ডার মুছে ফেলা",
  open: "খোলা",
  download: "ডাউনলোড",
  suspend: "স্থগিত",
  activate: "সক্রিয়",
  "password-reset": "পাসওয়ার্ড রিসেট",
  confirm: "সঠিক হিসেবে নিশ্চিত",
  correct: "সংশোধন",
  dismiss: "বাতিল",
  publish: "প্রকাশ",
  unpublish: "প্রকাশ বন্ধ",
  claim: "দায়িত্ব নেওয়া",
  release: "দায়িত্ব ছাড়া",
  answer: "উত্তর",
  close: "বন্ধ",
  reopen: "আবার খোলা",
  reassign: "দায়িত্ব বদল",
  run: "চালানো",
  "dry-run": "পরীক্ষামূলক চালানো",
  forget: "শেখা তথ্য মুছে ফেলা",
  clear: "খালি করা",
  unblock: "সীমার হিসাব শূন্য করা",
  takeover: "অন্যের দায়িত্ব নেওয়া",
};

export function actionLabel(action: string): string {
  if (ACTION_NAMES[action]) return ACTION_NAMES[action];
  const [area, verb] = action.split(".", 2);
  const areaName = area ? AREA_NAMES[area] : undefined;
  const verbName = verb ? ACTION_NAMES[verb] : undefined;
  return areaName && verbName ? `${areaName}: ${verbName}` : action;
}
