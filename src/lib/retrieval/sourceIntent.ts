import { SOURCE_PRIORITY } from "@/config/site";
import { composeNukta } from "@/lib/utils/bangla";
import type { SourceType } from "@/types";

const SOURCE_MARKERS: Record<SourceType, readonly string[]> = {
  quran: [
    "কুরআন",
    "কোরআন",
    "কোরান",
    "কুরান",
    "আয়াত",
    "সূরা",
    "সুরা",
    "quran",
    "qur'an",
    "koran",
    "kuran",
    "ayat",
    "ayah",
    "surah",
    "sura",
  ],
  hadith: ["হাদিস", "হাদীস", "হাদিছ", "hadith", "hadis", "hadees", "hadish"],
  ijma: ["ইজমা", "ijma", "ijmah", "ejma"],
  qiyas: ["কিয়াস", "কেয়াস", "ক্বিয়াস", "qiyas", "kiyas", "kias", "kayes", "keyas", "qias"],
  sirat: [
    "সীরাত",
    "সিরাত",
    "sirah",
    "seerah",
    "sirat",
    "জীবনী",
    "biography",
    "jiboni",
    "jibon kahini",
  ],
  fiqh: [
    "ফিকহ",
    "ফিকাহ",
    "ফিক্হ",
    "fiqh",
    "fiqah",
    "fikh",
    "ফতোয়া",
    "ফতওয়া",
    "fatwa",
    "fotoa",
    "fatoa",
    "মাযহাব",
    "মাজহাব",
    "madhhab",
    "mazhab",
    "majhab",
  ],
};

const TOPIC_AFTER: Partial<Record<SourceType, readonly string[]>> = {
  quran: [
    "তিলাওয়াত",
    "তেলাওয়াত",
    "পাঠ",
    "পড়া",
    "পড়ার",
    "খতম",
    "হিফজ",
    "হেফজ",
    "শিক্ষা",
    "শেখা",
    "tilawat",
    "telawat",
    "recitation",
    "reading",
  ],
};

const BOUNDARY = String.raw`(?:^|[\s,.।?!"'()\[\]/:;-])`;
const END = String.raw`(?=$|[\s,.।?!"'()\[\]/:;-])`;
const SUFFIX = "(?:ের|এর|ে|র|েও|ও|টি|টা|গুলো|গুলোর|সমূহ|সমূহের|িক|er|e|s|'s|ic)?";

function escapeTerm(term: string): string {
  return composeNukta(term)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/'/g, "['’]?");
}

function markerSource(sourceType: SourceType): string {
  const topics = TOPIC_AFTER[sourceType] ?? [];
  const notTopic = topics.length > 0 ? `(?!\\s*(?:${topics.map(escapeTerm).join("|")}))` : "";
  return `(?:${SOURCE_MARKERS[sourceType].map(escapeTerm).join("|")})${SUFFIX}${END}${notTopic}`;
}

const MATCHERS = SOURCE_PRIORITY.map((sourceType) => ({
  sourceType,
  pattern: new RegExp(`${BOUNDARY}${markerSource(sourceType)}`, "iu"),
  strip: new RegExp(`(${BOUNDARY})${markerSource(sourceType)}`, "giu"),
}));

export function detectSourceIntent(question: string): SourceType[] | null {
  const named = MATCHERS.filter(({ pattern }) => pattern.test(composeNukta(question))).map(
    ({ sourceType }) => sourceType,
  );
  return named.length > 0 ? named : null;
}

const SCOPE_ONLY_MARKERS: readonly SourceType[] = ["quran", "hadith"];

export function stripSourceMarkers(query: string, sources: readonly SourceType[]): string {
  const stripped = MATCHERS.filter(
    ({ sourceType }) => sources.includes(sourceType) && SCOPE_ONLY_MARKERS.includes(sourceType),
  )
    .reduce((text, { strip }) => text.replace(strip, "$1"), composeNukta(query))
    .replace(/\s+/g, " ")
    .trim();

  const unchanged = stripped === composeNukta(query).replace(/\s+/g, " ").trim();
  return !unchanged && /\p{L}{2}/u.test(stripped) ? stripped : query;
}
