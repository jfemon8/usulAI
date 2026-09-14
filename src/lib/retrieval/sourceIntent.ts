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

const TOPIC_BEFORE: Partial<Record<SourceType, readonly string[]>> = {
  quran: [
    "recite",
    "recites",
    "reciting",
    "read",
    "reads",
    "reading",
    "memorize",
    "memorise",
    "memorizing",
    "memorising",
    "touch",
    "touching",
    "hold",
    "holding",
    "carry",
    "carrying",
    "learn",
    "learning",
    "teach",
    "teaching",
    "complete",
    "finish",
  ],
};

function markerSource(sourceType: SourceType): string {
  const topics = TOPIC_AFTER[sourceType] ?? [];
  const notTopic = topics.length > 0 ? `(?!\\s*(?:${topics.map(escapeTerm).join("|")}))` : "";
  const verbs = TOPIC_BEFORE[sourceType] ?? [];
  const notObject =
    verbs.length > 0 ? `(?<!(?:${verbs.join("|")})\\s+(?:the\\s+(?:holy\\s+)?)?)` : "";
  return `${notObject}(?:${SOURCE_MARKERS[sourceType].map(escapeTerm).join("|")})${SUFFIX}${END}${notTopic}`;
}

const MATCHERS = SOURCE_PRIORITY.map((sourceType) => ({
  sourceType,
  pattern: new RegExp(`${BOUNDARY}${markerSource(sourceType)}`, "iu"),
  strip: new RegExp(`(${BOUNDARY})${markerSource(sourceType)}`, "giu"),
}));

const SCRIPTURE_PAIR = [
  String.raw`(?:কুরআন|কোরআন|কুরান|কোরান)\s*(?:ও|এবং|আর|,|-)?\s*(?:হাদিস|হাদীস|সুন্নাহ|সুন্নাহর)(?:ের|র|\s*এর)?`,
  String.raw`(?:quran|qur'?an|koran)\s*(?:o|and|&|,|-)?\s*(?:hadith|hadis|hadees|sunnah)(?:\s*er|s)?`,
];
const IN_LIGHT_OF = [
  "আলোকে",
  "আলোয়",
  "অনুযায়ী",
  "অনুসারে",
  "দৃষ্টিতে",
  "দৃষ্টিকোণ",
  "ভিত্তিতে",
  "মতে",
  "দলিলসহ",
  "দলীলসহ",
  "রেফারেন্সসহ",
  "aloke",
  "onujayi",
  "anujayi",
  "dristite",
  "drishtite",
  "mote",
];
const GENERIC_SCOPE = new RegExp(
  [
    ...SCRIPTURE_PAIR.map(
      (pair) => String.raw`${pair}\s*(?:${IN_LIGHT_OF.map(escapeTerm).join("|")})`,
    ),
    String.raw`(?:in\s+(?:the\s+)?light\s+of|according\s+to|based\s+on)\s+(?:the\s+)?(?:quran|qur'?an|koran)\s*(?:and|&|,)?\s*(?:the\s+)?(?:hadith|sunnah|hadiths)`,
  ]
    .map(composeNukta)
    .join("|"),
  "giu",
);

export function withoutGenericScope(question: string): string {
  return composeNukta(question).replace(GENERIC_SCOPE, " ");
}

export function detectSourceIntent(question: string): SourceType[] | null {
  const text = withoutGenericScope(question);
  const named = MATCHERS.filter(({ pattern }) => pattern.test(text)).map(
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
