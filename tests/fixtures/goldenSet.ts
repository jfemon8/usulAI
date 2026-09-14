import type { SourceType } from "@/types";

export interface GoldenCase {
  question: string;
  expectSources: SourceType[];
  forbidSources?: SourceType[];
  expectReferences?: string[];
  forbidReferences?: string[];
  mustNotBeEmpty?: boolean;
}

export const GOLDEN_SET: GoldenCase[] = [
  {
    question: "সুদ সম্পর্কে কুরআন কী বলে?",
    expectSources: ["quran"],
    forbidSources: ["hadith", "ijma", "qiyas", "sirat"],
    expectReferences: ["Al-Baqara 2:275"],
  },
  {
    question: "সুদ সম্পর্কে ইসলাম কী বলে?",
    expectSources: ["quran", "hadith"],
  },
  {
    question: "নিয়ত সম্পর্কে হাদিস",
    expectSources: ["hadith"],
    forbidSources: ["quran", "ijma", "qiyas", "sirat"],
  },
  { question: "zakat kader upor forz", expectSources: ["hadith"] },
  {
    question: "যাকাত কাদের উপর ফরজ",
    expectSources: ["quran"],
    expectReferences: ["At-Tawba 9:60"],
  },
  {
    question: "নামাজ কেন ফরজ",
    expectSources: ["quran", "hadith"],
    expectReferences: ["An-Nisaa 4:103"],
  },
  {
    question: "রোজা কোন মাসে ফরজ করা হয়েছে?",
    expectSources: ["quran"],
    expectReferences: ["Al-Baqara 2:185"],
  },
  {
    question: "হজ কার উপর ফরজ",
    expectSources: ["quran", "hadith"],
    expectReferences: ["Aal-i-Imraan 3:97"],
    forbidReferences: ["Al-Baqara 2:183"],
  },
  { question: "মদ্যপান সম্পর্কে নিষেধাজ্ঞা", expectSources: ["quran"] },
  { question: "মিথ্যা সাক্ষ্য দেওয়ার বিধান", expectSources: ["hadith"] },
  {
    question: "এতিমের সম্পদ সম্পর্কে নির্দেশ",
    expectSources: ["quran"],
    expectReferences: ["An-Nisaa 4:10"],
  },
  {
    question: "what does the Quran say about patience",
    expectSources: ["quran"],
    forbidSources: ["hadith", "ijma", "qiyas", "sirat", "fiqh"],
  },
  {
    question: "prayer facing the qibla",
    expectSources: ["quran", "hadith"],
    expectReferences: ["Al-Baqara 2:144"],
  },
  {
    question: "অজু ছাড়া নামাজ হবে কি? এ বিষয়ে ইজমা কী?",
    expectSources: ["ijma"],
    forbidSources: ["quran", "hadith"],
  },
  {
    question: "মদ পান সম্পর্কে আলেমদের ইজমা কী?",
    expectSources: ["ijma"],
    forbidSources: ["quran", "hadith"],
  },
  {
    question: "কিয়াস কী এবং কিয়াসের রুকন কয়টি?",
    expectSources: ["qiyas"],
    forbidSources: ["quran", "hadith", "ijma"],
  },
  {
    question: "কিয়াসে ইল্লত কীভাবে নির্ণয় করা হয়?",
    expectSources: ["qiyas"],
    forbidSources: ["quran", "hadith", "ijma"],
  },
  {
    question: "সীরাত অনুযায়ী বদর যুদ্ধ কীভাবে হয়েছিল?",
    expectSources: ["sirat"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas"],
  },
  {
    question: "সীরাতে হিজরতের ঘটনা কীভাবে বর্ণিত হয়েছে?",
    expectSources: ["sirat"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas"],
  },
  {
    question: "what does the seerah say about the battle of khandaq",
    expectSources: ["sirat"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas"],
  },
  {
    question: "what is qiyas and who rejected it",
    expectSources: ["qiyas"],
    forbidSources: ["quran", "hadith", "ijma"],
  },
  {
    question: "হযরত উমর (রা.)-এর জীবনী",
    expectSources: ["sirat"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas", "fiqh"],
    expectReferences: ["عمر بن الخطاب"],
  },
  {
    question: "ফাতিমা (রা.)-এর জীবনী",
    expectSources: ["sirat"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas", "fiqh"],
    expectReferences: ["فاطمة بنت رسول الله"],
  },
  {
    question: "নবী ইউসুফ (আ.)-এর জীবনী",
    expectSources: ["sirat"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas", "fiqh"],
    expectReferences: ["কাসাসুল আম্বিয়া"],
  },
  {
    question: "ইমাম আবু হানিফার জীবনী",
    expectSources: ["sirat"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas", "fiqh"],
    expectReferences: ["মানাকিবুল ইমাম আবী হানীফা"],
  },
  {
    question: "ফিকহ অনুযায়ী জুমার নামাজের শর্ত কী?",
    expectSources: ["fiqh"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas", "sirat"],
    expectReferences: ["صلاة الجمعة"],
  },
  {
    question: "হানাফী মাযহাবে অজু ভঙ্গের কারণ কী?",
    expectSources: ["fiqh"],
    forbidSources: ["quran", "hadith", "ijma", "qiyas", "sirat"],
  },
];
