const TERM_GROUPS: readonly (readonly string[])[] = [
  ["নামাজ", "নামায", "সালাত", "সলাত", "সালাহ"],
  ["রোজা", "রোযা", "সিয়াম", "সাওম", "রোজাদার"],
  ["রমজান", "রমযান", "রামাদান", "রামাদ্বান"],
  ["ফরজ", "ফরয", "ফারদ", "অবশ্যকর্তব্য"],
  ["হজ", "হজ্জ", "হাজ্জ"],
  ["জাকাত", "যাকাত", "যাকাহ", "জাকাহ"],
  ["সদকা", "সাদাকা", "সাদাকাহ", "সদকাহ"],
  ["কিবলা", "কিবলাহ", "কেবলা", "কাবা", "কাবাহ"],
  ["কুরআন", "কোরআন", "কোরান", "কিতাব"],
  ["হাদিস", "হাদীস", "হাদিছ"],
  ["রাসুল", "রাসূল", "রসুল", "নবি", "নবী"],
  ["ঈমান", "ইমান", "বিশ্বাস"],
  ["অজু", "ওজু", "ওযু", "উযু", "উজু"],
  ["দুআ", "দোয়া", "দুয়া", "প্রার্থনা"],
  ["সুদ", "রিবা", "সুদি"],
  ["মদ", "মাদক", "শরাব", "খামর", "মদ্যপান"],
  ["জান্নাত", "বেহেশত", "বেহেস্ত"],
  ["জাহান্নাম", "দোজখ", "দোযখ"],
  ["কিয়ামত", "কেয়ামত", "ক্বিয়ামত", "পুনরুত্থান"],
  ["তাওবা", "তওবা", "তাওবাহ", "ক্ষমা"],
  ["গুনাহ", "গোনাহ", "পাপ"],
  ["সওয়াব", "সাওয়াব", "ছওয়াব", "পুণ্য"],
  ["এতিম", "ইয়াতিম", "ইয়াতীম", "পিতৃহীন"],
  ["তালাক", "ত্বলাক", "বিবাহবিচ্ছেদ"],
  ["বিয়ে", "বিবাহ", "নিকাহ", "শাদি"],
  ["জুমা", "জুমুআ", "জুম্মা", "শুক্রবার"],
  ["কুরবানি", "কোরবানি", "কুরবানী", "উদহিয়া"],
  ["ফেরেশতা", "ফিরিশতা", "মালাইকা"],
  ["শয়তান", "শাইতান", "ইবলিস"],
  ["মুমিন", "মোমিন", "বিশ্বাসী"],
  ["কাফির", "কাফের", "অবিশ্বাসী"],
  ["মিসকিন", "মিসকীন", "অভাবী", "দরিদ্র"],
  ["prayer", "salat", "salah", "namaz"],
  ["fasting", "sawm", "siyam", "roza"],
  ["alms", "zakat", "zakah", "charity"],
  ["pilgrimage", "hajj"],
  ["qibla", "qiblah", "kaaba", "sacred mosque"],
  ["usury", "riba", "interest"],
  ["obligatory", "prescribed", "ordained", "fard"],
];

const BOUNDARY = String.raw`(?:^|[\s,.।?!"'()\[\]/\\:;-])`;

const TERM_MATCHERS: readonly { pattern: RegExp; group: readonly string[] }[] = TERM_GROUPS.flatMap(
  (group) =>
    group.map((term) => ({
      pattern: new RegExp(`${BOUNDARY}${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu"),
      group,
    })),
);

export function expandQueryTerms(query: string): string[] {
  const extras = new Set<string>();

  for (const { pattern, group } of TERM_MATCHERS) {
    if (!pattern.test(query)) continue;

    for (const term of group) {
      if (!query.toLowerCase().includes(term.toLowerCase())) extras.add(term);
    }
  }

  return [...extras];
}

export function expandQuery(query: string): string {
  const extras = expandQueryTerms(query);
  return extras.length > 0 ? `${query} ${extras.join(" ")}` : query;
}
