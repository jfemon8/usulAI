import type { SourceType } from "@/types";

export interface GoldenCase {
  question: string;
  expectSources: SourceType[];
  expectReferences?: string[];
  mustNotBeEmpty?: boolean;
}

export const GOLDEN_SET: GoldenCase[] = [
  {
    question: "সুদ সম্পর্কে কুরআন কী বলে?",
    expectSources: ["quran"],
    expectReferences: ["Al-Baqara 2:275"],
  },
  {
    question: "সুদ সম্পর্কে ইসলাম কী বলে?",
    expectSources: ["quran", "hadith"],
  },
  { question: "নিয়ত সম্পর্কে হাদিস", expectSources: ["hadith"] },
  { question: "zakat kader upor forz", expectSources: ["hadith"] },
  { question: "নামাজ কেন ফরজ", expectSources: ["quran", "hadith"] },
  { question: "রোজা কোন মাসে ফরজ করা হয়েছে?", expectSources: ["quran"] },
  { question: "হজ কার উপর ফরজ", expectSources: ["quran", "hadith"] },
  { question: "মদ্যপান সম্পর্কে নিষেধাজ্ঞা", expectSources: ["quran"] },
  { question: "মিথ্যা সাক্ষ্য দেওয়ার বিধান", expectSources: ["hadith"] },
  { question: "এতিমের সম্পদ সম্পর্কে নির্দেশ", expectSources: ["quran"] },
  { question: "what does the Quran say about patience", expectSources: ["quran"] },
  { question: "prayer facing the qibla", expectSources: ["quran", "hadith"] },
];
