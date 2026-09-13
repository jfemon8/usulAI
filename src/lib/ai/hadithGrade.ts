import type { HadithGrade } from "@/types";

export type { HadithGrade };

const GRADER_NAMES: Record<string, string> = {
  "al-albani": "আলবানী",
  albani: "আলবানী",
  "zubair ali zai": "যুবাইর আলী যাই",
  "ahmad muhammad shakir": "আহমাদ শাকির",
  "muhammad muhyi al-din abdul hamid": "মুহিউদ্দীন আব্দুল হামিদ",
  "shuaib al arnaut": "শুয়াইব আরনাউত",
  "shu'aib al-arna'ut": "শুয়াইব আরনাউত",
  "bashar awad maarouf": "বাশশার আওয়াদ মারুফ",
  darussalam: "দারুসসালাম",
  "ibn hajar": "ইবনে হাজার",
  "al-hakim": "হাকিম",
  "al-dhahabi": "যাহাবী",
};

const GRADE_PHRASES: Record<string, string> = {
  "hasan sahih": "হাসান সহীহ",
  "hasan gharib": "হাসান গরীব",
  "sahih gharib": "সহীহ গরীব",
  "sahih lighairihi": "সহীহ লিগাইরিহি",
  "hasan lighairihi": "হাসান লিগাইরিহি",
  "sahih mauquf": "সহীহ মাওকূফ",
  "sahih maqtu": "সহীহ মাকতূ",
  "very weak": "খুবই দুর্বল",
};

const GRADE_WORDS: Record<string, string> = {
  sahih: "সহীহ",
  saheeh: "সহীহ",
  hasan: "হাসান",
  daif: "যঈফ",
  daeef: "যঈফ",
  weak: "যঈফ",
  isnaad: "সনদ",
  isnad: "সনদ",
  maudu: "মাওযূ (জাল)",
  mawdu: "মাওযূ (জাল)",
  fabricated: "মাওযূ (জাল)",
  munkar: "মুনকার",
  shadh: "শায",
  mursal: "মুরসাল",
  mauquf: "মাওকূফ",
  mawquf: "মাওকূফ",
  maqtu: "মাকতূ",
  munqati: "মুনকাতি",
  gharib: "গরীব",
  jayyid: "জাইয়িদ",
  qawi: "কাবী",
  and: "ও",
  bukhari: "বুখারী",
  muslim: "মুসলিম",
  "al-bukhari": "বুখারী",
};

const WEAK_WORDS = new Set([
  "daif",
  "daeef",
  "weak",
  "maudu",
  "mawdu",
  "fabricated",
  "munkar",
  "shadh",
]);

function simplify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`'’‘"]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function banglaGraderName(name: string): string {
  return GRADER_NAMES[simplify(name)] ?? name;
}

export function banglaGrade(grade: string): string {
  const simple = simplify(grade);
  const phrase = GRADE_PHRASES[simple];
  if (phrase) return phrase;

  return simple
    .split(" ")
    .map((word) => GRADE_WORDS[word] ?? word)
    .join(" ");
}

export function isWeakGrade(grade: string): boolean {
  return simplify(grade)
    .split(" ")
    .some((word) => WEAK_WORDS.has(word));
}

export function describeGrades(grades: HadithGrade[] | undefined): string | undefined {
  const usable = (grades ?? []).filter((entry) => entry.grade.trim().length > 0);
  if (usable.length === 0) return undefined;

  return usable
    .map((entry) => `${banglaGrade(entry.grade)} (${banglaGraderName(entry.name)})`)
    .join("; ");
}

export function preferredGrade(grades: HadithGrade[] | undefined): string | undefined {
  const usable = (grades ?? []).filter((entry) => entry.grade.trim().length > 0);
  const chosen = usable.find((entry) => simplify(entry.name).includes("albani")) ?? usable[0];
  return chosen ? `${banglaGrade(chosen.grade)} (${banglaGraderName(chosen.name)})` : undefined;
}
