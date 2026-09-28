import { localDigits, type Lang } from "@/lib/general/calendar";
import type { DetectedClause } from "@/lib/general/intents";
import { cite, pick, type Section } from "@/lib/general/section";

interface Kalima {
  bn: string;
  en: string;
  arabic: string;
  bnReading: string;
  enReading: string;
  bnMeaning: string;
  enMeaning: string;
  evidence?: string[];
}

export const KALIMAS: Kalima[] = [
  {
    bn: "কালিমা তাইয়্যেবা",
    en: "Kalima Tayyibah (the word of purity)",
    arabic: "لَا إِلٰهَ إِلَّا اللّٰهُ مُحَمَّدٌ رَّسُوْلُ اللّٰهِ",
    bnReading: "লা ইলাহা ইল্লাল্লাহু মুহাম্মাদুর রাসূলুল্লাহ",
    enReading: "La ilaha illallahu Muhammadur Rasulullah",
    bnMeaning: "আল্লাহ ছাড়া কোনো ইলাহ (সত্য উপাস্য) নেই, মুহাম্মাদ ﷺ আল্লাহর রাসূল।",
    enMeaning: "There is no god but Allah; Muhammad ﷺ is the Messenger of Allah.",
    evidence: ["Muhammad 47:19", "Al-Fath 48:29"],
  },
  {
    bn: "কালিমা শাহাদাত",
    en: "Kalima Shahadah (the testimony)",
    arabic:
      "أَشْهَدُ أَنْ لَّا إِلٰهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيْكَ لَهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُوْلُهُ",
    bnReading:
      "আশহাদু আল লা ইলাহা ইল্লাল্লাহু ওয়াহদাহু লা শারীকা লাহু, ওয়া আশহাদু আন্না মুহাম্মাদান আবদুহু ওয়া রাসূলুহু",
    enReading:
      "Ashhadu an la ilaha illallahu wahdahu la sharika lahu, wa ashhadu anna Muhammadan 'abduhu wa rasuluhu",
    bnMeaning:
      "আমি সাক্ষ্য দিচ্ছি যে আল্লাহ ছাড়া কোনো ইলাহ নেই, তিনি এক, তাঁর কোনো শরিক নেই; এবং আমি সাক্ষ্য দিচ্ছি যে মুহাম্মাদ ﷺ তাঁর বান্দা ও রাসূল।",
    enMeaning:
      "I bear witness that there is no god but Allah, He is One and has no partner, and I bear witness that Muhammad ﷺ is His servant and Messenger.",
    evidence: ["সহীহ বুখারী 8"],
  },
  {
    bn: "কালিমা তাওহীদ",
    en: "Kalima Tawhid (the oneness of Allah)",
    arabic:
      "لَا إِلٰهَ إِلَّا أَنْتَ وَاحِدًا لَّا ثَانِيَ لَكَ مُحَمَّدٌ رَّسُوْلُ اللّٰهِ إِمَامُ الْمُتَّقِيْنَ رَسُوْلُ رَبِّ الْعَالَمِيْنَ",
    bnReading:
      "লা ইলাহা ইল্লা আনতা ওয়াহিদাল লা সানিয়া লাকা, মুহাম্মাদুর রাসূলুল্লাহি ইমামুল মুত্তাকীনা রাসূলু রাব্বিল আলামীন",
    enReading:
      "La ilaha illa anta wahidan la thaniya laka, Muhammadur Rasulullahi imamul muttaqina rasulu rabbil 'alamin",
    bnMeaning:
      "(হে আল্লাহ) তুমি ছাড়া কোনো ইলাহ নেই, তুমি এক, তোমার কোনো দ্বিতীয় নেই। মুহাম্মাদ ﷺ আল্লাহর রাসূল, মুত্তাকীদের ইমাম এবং বিশ্বজগতের প্রতিপালকের রাসূল।",
    enMeaning:
      "There is no god but You, the One who has no second. Muhammad ﷺ is the Messenger of Allah, the leader of the God-fearing and the Messenger of the Lord of the worlds.",
  },
  {
    bn: "কালিমা তামজীদ",
    en: "Kalima Tamjid (the glorification)",
    arabic:
      "سُبْحَانَ اللّٰهِ وَالْحَمْدُ لِلّٰهِ وَلَا إِلٰهَ إِلَّا اللّٰهُ وَاللّٰهُ أَكْبَرُ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ الْعَلِيِّ الْعَظِيْمِ",
    bnReading:
      "সুবহানাল্লাহি ওয়াল হামদু লিল্লাহি ওয়া লা ইলাহা ইল্লাল্লাহু ওয়াল্লাহু আকবার, ওয়া লা হাওলা ওয়া লা কুওয়াতা ইল্লা বিল্লাহিল আলিয়্যিল আযীম",
    enReading:
      "Subhanallahi wal-hamdu lillahi wa la ilaha illallahu wallahu akbar, wa la hawla wa la quwwata illa billahil 'aliyyil 'azim",
    bnMeaning:
      "আল্লাহ পবিত্র, সমস্ত প্রশংসা আল্লাহর, আল্লাহ ছাড়া কোনো ইলাহ নেই, আল্লাহ সবচেয়ে মহান। মহান ও সর্বোচ্চ আল্লাহর সাহায্য ছাড়া গুনাহ থেকে বাঁচার কোনো শক্তি ও নেক কাজের কোনো সামর্থ্য নেই।",
    enMeaning:
      "Glory be to Allah, all praise is for Allah, there is no god but Allah, and Allah is the Greatest. There is no might and no power except with Allah, the Most High, the Most Great.",
    evidence: ["সহীহ মুসলিম 5601", "সহীহ বুখারী 6384"],
  },
  {
    bn: "কালিমা রদ্দে কুফর",
    en: "Kalima Radd al-Kufr (rejecting disbelief)",
    arabic:
      "اَللّٰهُمَّ إِنِّيْ أَعُوْذُ بِكَ مِنْ أَنْ أُشْرِكَ بِكَ شَيْئًا وَّأَنَا أَعْلَمُ بِهِ وَأَسْتَغْفِرُكَ لِمَا لَا أَعْلَمُ بِهِ تُبْتُ عَنْهُ وَتَبَرَّأْتُ مِنَ الْكُفْرِ وَالشِّرْكِ وَالْمَعَاصِيْ كُلِّهَا وَأَسْلَمْتُ وَآمَنْتُ وَأَقُوْلُ لَا إِلٰهَ إِلَّا اللّٰهُ مُحَمَّدٌ رَّسُوْلُ اللّٰهِ",
    bnReading:
      "আল্লাহুম্মা ইন্নী আঊযু বিকা মিন আন উশরিকা বিকা শাইআও ওয়া আনা আ'লামু বিহী, ওয়া আসতাগফিরুকা লিমা লা আ'লামু বিহী, তুবতু আনহু ওয়া তাবাররা'তু মিনাল কুফরি ওয়াশ শিরকি ওয়াল মাআসী কুল্লিহা, ওয়া আসলামতু ওয়া আমানতু ওয়া আকূলু লা ইলাহা ইল্লাল্লাহু মুহাম্মাদুর রাসূলুল্লাহ",
    enReading:
      "Allahumma inni a'udhu bika min an ushrika bika shai'an wa ana a'lamu bihi, wa astaghfiruka lima la a'lamu bihi, tubtu 'anhu wa tabarra'tu minal kufri wash-shirki wal-ma'asi kulliha, wa aslamtu wa amantu wa aqulu la ilaha illallahu Muhammadur Rasulullah",
    bnMeaning:
      "হে আল্লাহ! জেনে-বুঝে তোমার সাথে কোনো কিছুকে শরিক করা থেকে আমি তোমার কাছে আশ্রয় চাই, আর অজান্তে যা হয়ে যায় তার জন্য ক্ষমা চাই। আমি তা থেকে তাওবা করছি, কুফর, শিরক ও সব গুনাহ থেকে নিজেকে মুক্ত ঘোষণা করছি। আমি আত্মসমর্পণ করলাম, ঈমান আনলাম এবং বলছি, আল্লাহ ছাড়া কোনো ইলাহ নেই, মুহাম্মাদ ﷺ আল্লাহর রাসূল।",
    enMeaning:
      "O Allah, I seek refuge in You from knowingly associating anything with You, and I ask Your forgiveness for what I do unknowingly. I repent of it and free myself from disbelief, polytheism and every sin. I submit, I believe, and I say: there is no god but Allah, Muhammad ﷺ is the Messenger of Allah.",
  },
];

const BN_ORDINALS = ["১", "২", "৩", "৪", "৫"];

function kalimaBlock(kalima: Kalima, index: number, lang: Lang): string {
  const title = pick(
    lang,
    `### ${BN_ORDINALS[index]}. ${kalima.bn}`,
    `### ${index + 1}. ${kalima.en}`,
  );
  const evidence = kalima.evidence ? cite(...kalima.evidence) : "";
  return [
    title,
    kalima.arabic,
    pick(lang, `**উচ্চারণ:** ${kalima.bnReading}`, `**Pronunciation:** ${kalima.enReading}`),
    pick(
      lang,
      `**অর্থ:** ${kalima.bnMeaning}${evidence}`,
      `**Meaning:** ${kalima.enMeaning}${evidence}`,
    ),
  ].join("\n\n");
}

function kalimaFazilat(lang: Lang): string {
  return pick(
    lang,
    `### কালিমার ফজিলত

- রাসূলুল্লাহ ﷺ বলেছেন, সর্বোত্তম যিকর “লা ইলাহা ইল্লাল্লাহ” এবং সর্বোত্তম দোয়া “আলহামদু লিল্লাহ”${cite("জামে তিরমিযী 3383")}।
- “লা ইলাহা ইল্লাল্লাহ”-এর জ্ঞান ও বিশ্বাস নিয়ে যে মারা যায়, সে জান্নাতে প্রবেশ করবে${cite("সহীহ মুসলিম 136")}।
- আল্লাহর কাছে সবচেয়ে প্রিয় চারটি বাক্য: সুবহানাল্লাহ, আলহামদু লিল্লাহ, লা ইলাহা ইল্লাল্লাহ ও আল্লাহু আকবার${cite("সহীহ মুসলিম 5601")}।
- “লা হাওলা ওয়া লা কুওয়াতা ইল্লা বিল্লাহ” জান্নাতের ভান্ডারগুলোর একটি${cite("সহীহ বুখারী 6384")}।
- কালিমার সাক্ষ্য ইসলামের পাঁচ স্তম্ভের প্রথম স্তম্ভ${cite("সহীহ বুখারী 8")}।`,
    `### Virtues of the Kalima

- The Prophet ﷺ said the best remembrance is "La ilaha illallah" and the best supplication is "Al-hamdu lillah"${cite("জামে তিরমিযী 3383")}.
- Whoever dies knowing that there is no god but Allah will enter Paradise${cite("সহীহ মুসলিম 136")}.
- The four phrases dearest to Allah are Subhanallah, Al-hamdu lillah, La ilaha illallah and Allahu akbar${cite("সহীহ মুসলিম 5601")}.
- "La hawla wa la quwwata illa billah" is one of the treasures of Paradise${cite("সহীহ বুখারী 6384")}.
- Bearing witness to the Kalima is the first of the five pillars of Islam${cite("সহীহ বুখারী 8")}.`,
  );
}

const KALIMA_NOTE = {
  bn: "*পাঁচ কালিমার এই নাম ও ক্রম আমাদের উপমহাদেশে শেখানোর সুবিধার জন্য প্রচলিত; কুরআন-হাদিসে এভাবে একসাথে তালিকা নেই। তবে প্রতিটির বাক্য কুরআন-হাদিসের শিক্ষা থেকেই নেওয়া।*",
  en: "*The names and order of the five Kalimas are a teaching convention of the Indian subcontinent; the Quran and Hadith do not list them together, though each phrase comes from their teachings.*",
};

export function kalimaSection(clause: DetectedClause, lang: Lang): Section {
  const only = clause.variant ? Number(clause.variant) - 1 : null;
  const fazilatOnly =
    clause.flags.includes("fazilat") && !clause.flags.includes("meaning") && only === null;
  const parts: string[] = [];

  if (!fazilatOnly) {
    const selected =
      only !== null && KALIMAS[only]
        ? [[KALIMAS[only], only] as const]
        : KALIMAS.map((k, i) => [k, i] as const);
    if (only === null) {
      parts.push(
        pick(
          lang,
          "পাঁচ কালিমা, উচ্চারণ ও অর্থসহ:",
          "The five Kalimas with pronunciation and meaning:",
        ),
      );
    }
    for (const [kalima, index] of selected) parts.push(kalimaBlock(kalima, index, lang));
  }
  if (fazilatOnly || clause.flags.includes("fazilat")) parts.push(kalimaFazilat(lang));
  if (!fazilatOnly && only === null) parts.push(pick(lang, KALIMA_NOTE.bn, KALIMA_NOTE.en));

  return { text: parts.join("\n\n") };
}

export function salahImportanceSection(lang: Lang): Section {
  return {
    text: pick(
      lang,
      `### নামাজের গুরুত্ব

নামাজ ইসলামের দ্বিতীয় স্তম্ভ এবং ঈমানের পর সবচেয়ে গুরুত্বপূর্ণ ইবাদত।

- **নির্ধারিত সময়ে ফরজ:** নির্দিষ্ট সময়ে নামাজ আদায় করা মুমিনদের ওপর ফরজ করা হয়েছে${cite("An-Nisaa 4:103")}।
- **ইসলামের স্তম্ভ:** কালিমার সাক্ষ্যের পরই নামাজ কায়েম করা ইসলামের দ্বিতীয় স্তম্ভ${cite("সহীহ বুখারী 8")}।
- **দিনে-রাতে পাঁচ ওয়াক্ত:** আল্লাহ প্রতিদিন পাঁচ ওয়াক্ত নামাজ ফরজ করেছেন${cite("সহীহ বুখারী 1395")}।
- **কিয়ামতে প্রথম হিসাব:** কিয়ামতের দিন বান্দার আমলের মধ্যে সবার আগে নামাজের হিসাব নেওয়া হবে${cite("জামে তিরমিযী 413")}।
- **নামাজ ত্যাগের ভয়াবহতা:** মানুষ এবং শিরক ও কুফরের মাঝে পার্থক্য হলো নামাজ ছেড়ে দেওয়া${cite("সহীহ মুসলিম 246")}।
- **চরিত্র গঠন:** নামাজ অশ্লীল ও মন্দ কাজ থেকে বিরত রাখে${cite("Al-Ankaboot 29:45")}।`,
      `### Why prayer matters

Prayer is the second pillar of Islam and the most important act of worship after faith.

- **Obligatory at set times:** prayer has been made obligatory on the believers at fixed times${cite("An-Nisaa 4:103")}.
- **A pillar of Islam:** establishing prayer comes right after the testimony of faith${cite("সহীহ বুখারী 8")}.
- **Five times a day:** Allah has made five prayers obligatory in every day and night${cite("সহীহ বুখারী 1395")}.
- **First to be judged:** prayer is the first deed a servant will be asked about on the Day of Judgement${cite("জামে তিরমিযী 413")}.
- **Abandoning it:** between a person and polytheism and disbelief stands the abandoning of prayer${cite("সহীহ মুসলিম 246")}.
- **It shapes character:** prayer keeps one away from indecency and wrongdoing${cite("Al-Ankaboot 29:45")}.`,
    ),
  };
}

export function salahFazilatSection(lang: Lang): Section {
  return {
    text: pick(
      lang,
      `### নামাজের ফজিলত

- **গুনাহ মুছে যায়:** কারো দরজায় নদী থাকলে এবং সে দিনে পাঁচবার তাতে গোসল করলে যেমন শরীরে ময়লা থাকে না, পাঁচ ওয়াক্ত নামাজ দিয়ে আল্লাহ তেমনি গুনাহ মুছে দেন${cite("সহীহ বুখারী 528")}।
- **সবচেয়ে প্রিয় আমল:** আল্লাহর কাছে সবচেয়ে প্রিয় আমল হলো সময়মতো নামাজ আদায় করা${cite("সহীহ বুখারী 527")}।
- **জামাতের মর্যাদা:** জামাতে নামাজ একা পড়ার চেয়ে ২৭ গুণ বেশি মর্যাদার${cite("সহীহ বুখারী 645")}।
- **জান্নাতে ঘর:** যে প্রতিদিন ফরজের অতিরিক্ত ১২ রাকাত সুন্নাত পড়ে, আল্লাহ তার জন্য জান্নাতে ঘর তৈরি করেন${cite("সহীহ মুসলিম 1696", "জামে তিরমিযী 414")}।
- **পবিত্র জীবন:** নামাজ অশ্লীলতা ও মন্দ কাজ থেকে বিরত রাখে${cite("Al-Ankaboot 29:45")}।`,
      `### Virtues of prayer

- **Sins are washed away:** just as bathing five times a day in a river at one's door leaves no dirt, Allah wipes away sins through the five prayers${cite("সহীহ বুখারী 528")}.
- **The dearest deed:** the deed dearest to Allah is prayer offered on time${cite("সহীহ বুখারী 527")}.
- **Congregation:** prayer in congregation is twenty-seven times better than praying alone${cite("সহীহ বুখারী 645")}.
- **A house in Paradise:** whoever prays twelve voluntary rak'ahs every day beyond the obligatory ones, Allah builds a house for them in Paradise${cite("সহীহ মুসলিম 1696", "জামে তিরমিযী 414")}.
- **A purified life:** prayer keeps one away from indecency and wrongdoing${cite("Al-Ankaboot 29:45")}.`,
    ),
  };
}

interface RakatRow {
  key: string;
  bn: string;
  en: string;
  before: [string, string];
  fard: number;
  after: [string, string];
}

const RAKAT_ROWS: RakatRow[] = [
  {
    key: "fajr",
    bn: "ফজর",
    en: "Fajr",
    before: ["২ সুন্নাতে মুয়াক্কাদা", "2 Sunnah mu'akkadah"],
    fard: 2,
    after: ["নেই", "None"],
  },
  {
    key: "dhuhr",
    bn: "যোহর",
    en: "Dhuhr",
    before: ["৪ সুন্নাতে মুয়াক্কাদা", "4 Sunnah mu'akkadah"],
    fard: 4,
    after: ["২ সুন্নাতে মুয়াক্কাদা (+২ নফল)", "2 Sunnah mu'akkadah (+2 nafl)"],
  },
  {
    key: "asr",
    bn: "আসর",
    en: "Asr",
    before: ["৪ সুন্নাতে গায়রে মুয়াক্কাদা", "4 Sunnah ghayr mu'akkadah"],
    fard: 4,
    after: ["নেই", "None"],
  },
  {
    key: "maghrib",
    bn: "মাগরিব",
    en: "Maghrib",
    before: ["নেই", "None"],
    fard: 3,
    after: ["২ সুন্নাতে মুয়াক্কাদা (+২ নফল)", "2 Sunnah mu'akkadah (+2 nafl)"],
  },
  {
    key: "isha",
    bn: "এশা",
    en: "Isha",
    before: ["৪ সুন্নাতে গায়রে মুয়াক্কাদা", "4 Sunnah ghayr mu'akkadah"],
    fard: 4,
    after: [
      "২ সুন্নাতে মুয়াক্কাদা, তারপর ৩ রাকাত বিতর (ওয়াজিব)",
      "2 Sunnah mu'akkadah, then 3 rak'ahs of Witr (wajib)",
    ],
  },
  {
    key: "jumua",
    bn: "জুমা",
    en: "Jumu'ah",
    before: ["৪ সুন্নাতে মুয়াক্কাদা", "4 Sunnah mu'akkadah"],
    fard: 2,
    after: ["৪ সুন্নাতে মুয়াক্কাদা (+২ সুন্নাত)", "4 Sunnah mu'akkadah (+2 Sunnah)"],
  },
];

export function rakatSection(clause: DetectedClause, lang: Lang): Section {
  const wanted = clause.variant === "witr" ? "isha" : clause.variant;
  const rows = wanted ? RAKAT_ROWS.filter((row) => row.key === wanted) : RAKAT_ROWS;
  const selected = rows.length > 0 ? rows : RAKAT_ROWS;
  const index = lang === "bn" ? 0 : 1;
  const table = [
    pick(
      lang,
      "| নামাজ | ফরজের আগে | ফরজ | ফরজের পরে |",
      "| Prayer | Before the fard | Fard | After the fard |",
    ),
    "| --- | --- | --- | --- |",
    ...selected.map(
      (row) =>
        `| **${pick(lang, row.bn, row.en)}** | ${row.before[index]} | ${localDigits(row.fard, lang)} | ${row.after[index]} |`,
    ),
  ].join("\n");

  const witr =
    clause.variant === "witr"
      ? pick(
          lang,
          "বিতর নামাজ **৩ রাকাত**, হানাফি মাযহাবে ওয়াজিব; এশার পর থেকে সুবহে সাদিকের আগ পর্যন্ত পড়া যায়।\n\n",
          "Witr is **3 rak'ahs** and wajib in the Hanafi school; it is prayed after Isha until true dawn.\n\n",
        )
      : "";
  const summary =
    selected.length > 1
      ? pick(
          lang,
          `\n\n- দৈনিক ফরজ **১৭ রাকাত** (ফজর ২, যোহর ৪, আসর ৪, মাগরিব ৩, এশা ৪)\n- সুন্নাতে মুয়াক্কাদা **১২ রাকাত**, যা নিয়মিত পড়লে জান্নাতে ঘরের সুসংবাদ আছে${cite("জামে তিরমিযী 414")}\n- বিতর **৩ রাকাত** (হানাফি মতে ওয়াজিব)`,
          `\n\n- **17 obligatory rak'ahs** a day (Fajr 2, Dhuhr 4, Asr 4, Maghrib 3, Isha 4)\n- **12 rak'ahs of Sunnah mu'akkadah**, promised a house in Paradise when kept regularly${cite("জামে তিরমিযী 414")}\n- Witr is **3 rak'ahs** (wajib in the Hanafi school)`,
        )
      : "";

  return {
    text: `${witr}${pick(lang, "### কোন নামাজ কত রাকাত", "### Rak'ahs of each prayer")}\n\n${table}${summary}\n\n${pick(
      lang,
      "*ফরজের রাকাত সংখ্যা সর্বসম্মত; সুন্নাত ও বিতরের বিন্যাস হানাফি মাযহাব অনুযায়ী দেওয়া হলো।*",
      "*The number of obligatory rak'ahs is agreed upon; the Sunnah and Witr follow the Hanafi school.*",
    )}`,
  };
}

export function sawmNiyatSection(lang: Lang): Section {
  return {
    text: pick(
      lang,
      `### রোজার নিয়ত

নিয়ত মূলত অন্তরের সংকল্প: “আমি আগামীকাল রমজানের রোজা রাখব”, মনে মনে এটুকু ঠিক করে নিলেই নিয়ত হয়ে যায়। রোজার উদ্দেশ্যে সেহরি খাওয়াও নিয়ত হিসেবে যথেষ্ট; মুখে উচ্চারণ করা জরুরি নয়। রাতেই নিয়ত করে নেওয়া উত্তম।

মুখে বলতে চাইলে প্রচলিত আরবি নিয়ত:

نَوَيْتُ أَنْ أَصُوْمَ غَدًا مِّنْ شَهْرِ رَمَضَانَ الْمُبَارَكِ فَرْضًا لَّكَ يَا اللّٰهُ فَتَقَبَّلْ مِنِّيْ إِنَّكَ أَنْتَ السَّمِيْعُ الْعَلِيْمُ

**উচ্চারণ:** নাওয়াইতু আন আসূমা গাদাম মিন শাহরি রমাদানাল মুবারাকি ফারদাল লাকা ইয়া আল্লাহু, ফাতাকাব্বাল মিন্নী, ইন্নাকা আনতাস সামীউল আলীম

**অর্থ:** হে আল্লাহ! আমি আগামীকাল বরকতময় রমজান মাসের ফরজ রোজা তোমার জন্য রাখার নিয়ত করছি। আমার পক্ষ থেকে তা কবুল করো, নিশ্চয়ই তুমি সর্বশ্রোতা, সর্বজ্ঞ।

*এই শব্দগুলো হাদিস থেকে বর্ণিত নয়, প্রচলিত একটি রূপ; বাংলায় মনে মনে সংকল্প করলেও নিয়ত পূর্ণ হয়।*`,
      `### The intention (niyyah) for fasting

The intention is a resolve of the heart: deciding "I will fast tomorrow in Ramadan" is enough. Eating suhoor in order to fast also counts as the intention, and saying it aloud is not required. It is best to make the intention at night.

A commonly recited Arabic wording, for those who wish to say it:

نَوَيْتُ أَنْ أَصُوْمَ غَدًا مِّنْ شَهْرِ رَمَضَانَ الْمُبَارَكِ فَرْضًا لَّكَ يَا اللّٰهُ فَتَقَبَّلْ مِنِّيْ إِنَّكَ أَنْتَ السَّمِيْعُ الْعَلِيْمُ

**Pronunciation:** Nawaytu an asuma ghadan min shahri Ramadanal-mubaraki fardan laka ya Allahu, fataqabbal minni, innaka antas-Sami'ul-'Alim

**Meaning:** O Allah, I intend to keep tomorrow's obligatory fast of the blessed month of Ramadan for You. Accept it from me; You are the All-Hearing, the All-Knowing.

*This wording is customary, not narrated in a hadith; an intention in your own language, or simply in the heart, is valid.*`,
    ),
  };
}

export function iftarDuaSection(lang: Lang): Section {
  return {
    text: pick(
      lang,
      `### ইফতারের দোয়া

ইফতারের জন্য আলাদা কোনো নিয়ত নেই। “বিসমিল্লাহ” বলে দ্রুত ইফতার করা সুন্নাত${cite("সহীহ বুখারী 1957")}, এবং ইফতারের পর রাসূলুল্লাহ ﷺ বলতেন${cite("সুনানে আবু দাউদ 2357")}:

ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوْقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللّٰهُ

**উচ্চারণ:** যাহাবায যামাউ, ওয়াবতাল্লাতিল উরূকু, ওয়া সাবাতাল আজরু ইনশাআল্লাহ

**অর্থ:** পিপাসা দূর হয়েছে, শিরা-উপশিরা সিক্ত হয়েছে, আর আল্লাহ চাইলে প্রতিদান নিশ্চিত হয়েছে।

প্রচলিত আরেকটি দোয়া “আল্লাহুম্মা লাকা সুমতু ওয়া আলা রিযকিকা আফতারতু” (হে আল্লাহ! তোমার জন্য রোজা রেখেছি এবং তোমার রিযিক দিয়েই ইফতার করছি) আবু দাউদে বর্ণিত হয়েছে, তবে মুহাদ্দিসগণ এর সনদকে দুর্বল বলেছেন${cite("সুনানে আবু দাউদ 2358")}।`,
      `### The dua for iftar

There is no separate intention for iftar. It is Sunnah to break the fast promptly with "Bismillah"${cite("সহীহ বুখারী 1957")}, and after breaking it the Prophet ﷺ used to say${cite("সুনানে আবু দাউদ 2357")}:

ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوْقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللّٰهُ

**Pronunciation:** Dhahabaz-zama'u, wabtallatil-'uruqu, wa thabatal-ajru in sha' Allah

**Meaning:** The thirst has gone, the veins are moistened, and the reward is certain, if Allah wills.

Another popular dua, "Allahumma laka sumtu wa 'ala rizqika aftartu" (O Allah, for You I fasted and with Your provision I break my fast), is reported by Abu Dawud, but the hadith scholars graded its chain weak${cite("সুনানে আবু দাউদ 2358")}.`,
    ),
  };
}

export function sawmFazilatSection(lang: Lang): Section {
  return {
    text: pick(
      lang,
      `### রোজার ফজিলত

- **তাকওয়ার জন্য ফরজ:** আগের উম্মতদের মতো আমাদের ওপরও রোজা ফরজ করা হয়েছে, যাতে আমরা মুত্তাকী হতে পারি${cite("Al-Baqara 2:183")}।
- **আগের গুনাহ মাফ:** ঈমান ও সওয়াবের আশায় রমজানের রোজা রাখলে আগের গুনাহ মাফ করে দেওয়া হয়${cite("সহীহ বুখারী 38")}।
- **প্রতিদান আল্লাহ নিজে দেবেন:** আল্লাহ বলেন, রোজা আমার জন্য, আমিই এর প্রতিদান দেব; রোজা ঢালস্বরূপ${cite("সহীহ বুখারী 1904")}।
- **রাইয়ান দরজা:** জান্নাতের রাইয়ান নামের দরজা দিয়ে শুধু রোজাদাররাই প্রবেশ করবে${cite("সহীহ বুখারী 1896")}।
- **সেহরিতে বরকত:** সেহরি খাও, কেননা সেহরিতে বরকত রয়েছে${cite("সহীহ বুখারী 1923")}।
- **দ্রুত ইফতার:** মানুষ যতদিন তাড়াতাড়ি ইফতার করবে, ততদিন কল্যাণের ওপর থাকবে${cite("সহীহ বুখারী 1957")}।`,
      `### Virtues of fasting

- **Prescribed for taqwa:** fasting was prescribed for us as it was for those before us, so that we may become God-conscious${cite("Al-Baqara 2:183")}.
- **Past sins forgiven:** whoever fasts Ramadan with faith and hoping for reward has their past sins forgiven${cite("সহীহ বুখারী 38")}.
- **Rewarded by Allah Himself:** Allah says fasting is for Him and He will reward it; fasting is a shield${cite("সহীহ বুখারী 1904")}.
- **The gate of Ar-Rayyan:** only those who fasted will enter Paradise through the gate called Ar-Rayyan${cite("সহীহ বুখারী 1896")}.
- **Blessing in suhoor:** take suhoor, for there is blessing in it${cite("সহীহ বুখারী 1923")}.
- **Hastening iftar:** people remain upon good as long as they hasten to break the fast${cite("সহীহ বুখারী 1957")}.`,
    ),
  };
}

export function hajjFazilatSection(lang: Lang): Section {
  return {
    text: pick(
      lang,
      `### হজের ফজিলত

- **সামর্থ্যবানদের ওপর ফরজ:** যাদের সেখানে যাওয়ার সামর্থ্য আছে, তাদের ওপর আল্লাহর জন্য বাইতুল্লাহর হজ করা ফরজ${cite("Aal-i-Imraan 3:97")}।
- **নবজাতকের মতো নিষ্পাপ:** যে আল্লাহর জন্য হজ করে এবং অশ্লীল কথা ও গুনাহ থেকে বিরত থাকে, সে সেদিনের মতো নিষ্পাপ হয়ে ফেরে যেদিন তার মা তাকে জন্ম দিয়েছিল${cite("সহীহ বুখারী 1521")}।
- **প্রতিদান জান্নাত:** মাবরুর (কবুল) হজের প্রতিদান জান্নাত ছাড়া আর কিছু নয়; আর এক উমরা থেকে আরেক উমরা মাঝের গুনাহের কাফফারা${cite("সহীহ বুখারী 1773")}।
- **শ্রেষ্ঠ আমলগুলোর একটি:** ঈমান ও আল্লাহর পথে জিহাদের পরই শ্রেষ্ঠ আমল মাবরুর হজ${cite("সহীহ বুখারী 1519")}।
- **আরাফার দিন:** আরাফার দিনের চেয়ে বেশি বান্দাকে আল্লাহ অন্য কোনো দিন জাহান্নাম থেকে মুক্তি দেন না; তিনি নিকটবর্তী হন এবং ফেরেশতাদের সামনে হাজিদের নিয়ে গর্ব করেন${cite("সহীহ মুসলিম 3288")}।`,
      `### Virtues of Hajj

- **Obligatory on those able:** pilgrimage to the House is a duty owed to Allah by everyone able to make the journey${cite("Aal-i-Imraan 3:97")}.
- **Sinless as a newborn:** whoever performs Hajj for Allah, avoiding obscenity and sin, returns as free of sin as the day their mother bore them${cite("সহীহ বুখারী 1521")}.
- **Paradise as the reward:** the reward of an accepted Hajj (Hajj mabrur) is nothing less than Paradise, and one Umrah to the next expiates what lies between${cite("সহীহ বুখারী 1773")}.
- **Among the best deeds:** after faith and striving in Allah's cause, the best deed is an accepted Hajj${cite("সহীহ বুখারী 1519")}.
- **The Day of Arafah:** there is no day on which Allah frees more servants from the Fire than the Day of Arafah; He draws near and speaks proudly of the pilgrims to the angels${cite("সহীহ মুসলিম 3288")}.`,
    ),
  };
}

export function zakatRateSection(lang: Lang): Section {
  return {
    text: pick(
      lang,
      `### যাকাতের পরিমাণ

যাকাতের হার **২.৫%**, অর্থাৎ যাকাতযোগ্য মোট সম্পদের চল্লিশ ভাগের এক ভাগ${cite("সুনানে আবু দাউদ 1573")}। যেমন ১,০০,০০০ টাকায় যাকাত ২,৫০০ টাকা।

**কখন ফরজ হয়:**
- মুসলিম, প্রাপ্তবয়স্ক ও সুস্থ মস্তিষ্কের হওয়া
- মৌলিক প্রয়োজন ও ঋণ বাদ দিয়ে নিসাব পরিমাণ সম্পদের মালিক হওয়া
- সেই সম্পদের ওপর পূর্ণ এক চান্দ্র (হিজরি) বছর অতিবাহিত হওয়া

**যেসব সম্পদে যাকাত:** নগদ ও ব্যাংকে জমা টাকা, সোনা-রুপা (হানাফি মতে গহনাসহ), ব্যবসার পণ্য, ফেরত পাওয়ার আশা আছে এমন পাওনা, শেয়ার ও বিনিয়োগ। বসবাসের বাড়ি, ব্যবহারের গাড়ি, আসবাব ও পরিধেয় কাপড়ে যাকাত নেই।

**কারা পাবেন:** ফকির, মিসকিন, যাকাত আদায়ের কর্মী, মন আকৃষ্ট করার জন্য, দাসমুক্তি, ঋণগ্রস্ত, আল্লাহর পথে ও মুসাফির, এই আট শ্রেণি${cite("At-Tawba 9:60")}।`,
      `### How much zakat

The rate is **2.5%**, one fortieth of your total zakatable wealth${cite("সুনানে আবু দাউদ 1573")}. For example, on BDT 1,00,000 the zakat is BDT 2,500.

**When it is due:**
- You are Muslim, adult and of sound mind
- You own at least the nisab beyond your basic needs and debts
- A full lunar (Hijri) year has passed over that wealth

**What is counted:** cash and bank savings, gold and silver (including jewellery in the Hanafi school), business stock, money owed to you that you expect back, shares and investments. There is no zakat on the home you live in, a car for personal use, furniture or clothes.

**Who receives it:** the poor, the needy, zakat workers, those whose hearts are to be won, freeing captives, debtors, in Allah's cause and the stranded traveller, the eight groups named in the Quran${cite("At-Tawba 9:60")}.`,
    ),
  };
}

export function zakatFazilatSection(lang: Lang): Section {
  return {
    text: pick(
      lang,
      `### যাকাতের গুরুত্ব ও ফজিলত

- **ইসলামের স্তম্ভ:** যাকাত ইসলামের পাঁচ স্তম্ভের একটি${cite("সহীহ বুখারী 8")}।
- **নামাজের সাথে আদেশ:** কুরআনে নামাজ কায়েমের সাথেই যাকাত দেওয়ার আদেশ এসেছে${cite("Al-Baqara 2:43")}।
- **সম্পদ ও মনের পবিত্রতা:** যাকাত সম্পদ ও মনকে পবিত্র করে এবং বরকত বাড়ায়${cite("At-Tawba 9:103")}।
- **গরিবের হক:** যাকাত ধনীদের কাছ থেকে নিয়ে তাদেরই গরিবদের মাঝে ফিরিয়ে দেওয়া হয়${cite("সহীহ বুখারী 1395")}।
- **না দেওয়ার শাস্তি:** যে যাকাত দেয় না, কিয়ামতের দিন তার সম্পদ বিষধর সাপ হয়ে তার গলা পেঁচিয়ে ধরবে${cite("সহীহ বুখারী 1403")}।`,
      `### Why zakat matters

- **A pillar of Islam:** zakat is one of the five pillars${cite("সহীহ বুখারী 8")}.
- **Commanded with prayer:** the Quran commands giving zakat together with establishing prayer${cite("Al-Baqara 2:43")}.
- **Purifies wealth and heart:** zakat purifies the giver and brings growth${cite("At-Tawba 9:103")}.
- **The right of the poor:** it is taken from the wealthy and returned to the poor among them${cite("সহীহ বুখারী 1395")}.
- **The warning:** whoever withholds zakat will find their wealth turned into a venomous snake coiled around their neck on the Day of Resurrection${cite("সহীহ বুখারী 1403")}.`,
    ),
  };
}
