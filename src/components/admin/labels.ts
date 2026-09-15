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
};

const ACTION_NAMES: Record<string, string> = {
  "auth.login": "লগইন",
  "auth.logout": "লগআউট",
  "auth.reset-requested": "পাসওয়ার্ড রিসেটের অনুরোধ",
  "auth.password-reset": "রিসেট লিংকে পাসওয়ার্ড সেট",
  "auth.password-changed": "পাসওয়ার্ড পরিবর্তন",
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
};

export function actionLabel(action: string): string {
  if (ACTION_NAMES[action]) return ACTION_NAMES[action];
  const [area, verb] = action.split(".", 2);
  const areaName = area ? AREA_NAMES[area] : undefined;
  const verbName = verb ? ACTION_NAMES[verb] : undefined;
  return areaName && verbName ? `${areaName}: ${verbName}` : action;
}
