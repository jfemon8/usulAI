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
  hadith: ["হাদিস", "হাদীস", "হাদিছ", "hadith", "hadis", "hadees"],
  ijma: ["ইজমা", "ijma"],
  qiyas: ["কিয়াস", "qiyas"],
  sirat: ["সীরাত", "সিরাত", "sirah", "seerah", "sirat"],
};

const BOUNDARY = String.raw`(?:^|[\s,.।?!"'()\[\]/:;-])`;
const END = String.raw`(?=$|[\s,.।?!"'()\[\]/:;-])`;
const SUFFIX = "(?:ের|এর|ে|র|েও|ও|টি|টা|গুলো|গুলোর|সমূহ|সমূহের|িক|er|e|s|'s|ic)?";

const MATCHERS = SOURCE_PRIORITY.map((sourceType) => ({
  sourceType,
  pattern: new RegExp(
    `${BOUNDARY}(?:${SOURCE_MARKERS[sourceType].map((marker) => composeNukta(marker).replace(/'/g, "['’]?")).join("|")})${SUFFIX}${END}`,
    "iu",
  ),
}));

export function detectSourceIntent(question: string): SourceType[] | null {
  const named = MATCHERS.filter(({ pattern }) => pattern.test(composeNukta(question))).map(
    ({ sourceType }) => sourceType,
  );
  return named.length > 0 ? named : null;
}
