import { GENERAL_ASSISTANT_CONFIG } from "@/config/site";
import { composeNukta } from "@/lib/utils/bangla";
import { isAmountToken, parseZakatAssets, ZAKAT_AMOUNT_WORDS } from "@/lib/general/zakatMath";
import type { GeneralIntent, ZakatAssets } from "@/types";

export type ReplyLang = "bn" | "en";

export type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha" | "sehri" | "iftar";

export type PhraseIntent =
  | "salam"
  | "salamReply"
  | "greeting"
  | "wellbeing"
  | "identity"
  | "capabilities"
  | "creator"
  | "thanks"
  | "goodbye";

export interface DetectedClause {
  intent: GeneralIntent;
  variant?: string;
  placeWords: string[];
  flags: string[];
  prayer?: PrayerKey;
  explicitLocation: boolean;
  assets?: ZakatAssets;
}

export interface GeneralDetection {
  lang: ReplyLang;
  clauses: DetectedClause[];
}

type Script = "bangla" | "banglish" | "english" | "arabic";

interface PhrasePattern {
  intent: PhraseIntent;
  script: Script;
  variant?: string;
  pattern: RegExp;
}

function phrases(
  intent: PhraseIntent,
  script: Script,
  sources: string[],
  variant?: string,
): PhrasePattern[] {
  return sources.map((source) => ({
    intent,
    script,
    ...(variant ? { variant } : {}),
    pattern: new RegExp(`^(?:${composeNukta(source)})$`, "u"),
  }));
}

const BN_WHAT = "(?:কী|কি)";
const BN_YOU = "(?:তুমি|আপনি|তুই|তোমরা)";
const BN_YOUR = "(?:তোমার|আপনার|তোর)";
const BN_YOU_OBJ = "(?:তোমাকে|আপনাকে|তোকে|তোমায়|তোমারে)";
const BN_WHO = "(?:কে|কারা)";
const BN_MADE =
  "(?:বানিয়েছ(?:ে|েন|ো)?|বানাই(?:ছে|সে|ছেন|ছো|লো)|বানা(?:ল|লো|লেন)|তৈরি কর(?:েছে|েছেন|ছে|লো|ল|েছো)|ডেভেলপ কর(?:েছে|েছেন|ছে)|প্রোগ্রাম কর(?:েছে|েছেন))";
const BN_RAHMAH = "(?: ওয়া ?রাহমাতুল্লাহি?(?: ওয়া ?বারাকাতুহু?)?)?";

const EN_YOU = "(?:you|u|ya)";
const BL_YOU = "(?:tumi|apni|tui|tmi|tomra)";
const BL_YOUR = "(?:tomar|apnar|tor|tmr)";
const BL_YOU_OBJ = "(?:tomake|tomak|tomay|apnake|toke|tmk|tmke|tomare)";
const BL_WHO = "(?:ke|k|kara)";
const BL_MADE =
  "(?:baniyeche|baniyechen|baniyecho|baniyese|banaiche|banaise|banaichen|banaisen|banaiso|banailo|banalo|banaice|(?:toiri|tori|tairi) (?:koreche|korechen|korse|korche|korlo)|(?:develop|create|make|program) (?:koreche|korechen|korse|korche))";
const LATIN_RAHMAH = "(?: wa? ?rahmatul+ah[ie]?(?: wa? ?barakatu(?:hu|h)?)?)?";

const PHRASES: PhrasePattern[] = [
  ...phrases("salam", "bangla", [
    `(?:আস ?|আছ ?)?সালামু? ?(?:আ|য়া|ইয়া|ও|এ)?লাই?কুম${BN_RAHMAH}`,
    "সালাম",
  ]),
  ...phrases("salam", "banglish", [
    `(?:as+|a)? ?sa?l+a+m+[ou]? ?(?:a|wa|o)?l[ae]i?[iy]?k[ou]m+${LATIN_RAHMAH}`,
    "salam|slm|salaam",
  ]),
  ...phrases("salam", "arabic", ["ال?سلام عليكم(?: ورحمة الله(?: وبركاته)?)?"]),
  ...phrases("salamReply", "bangla", [
    `ওয়া? ?(?:আ)?লাই?কুমু?(?:স|ছ)? ?(?:আস|আছ)?সালাম${BN_RAHMAH}`,
  ]),
  ...phrases("salamReply", "banglish", [
    `w[ao]? ?[ae]?l[ae]i?[iy]?k[ou]m+ ?(?:[ua]s|os)? ?(?:as)?sal+a+m${LATIN_RAHMAH}`,
  ]),
  ...phrases("salamReply", "arabic", ["وعليكم ال?سلام(?: ورحمة الله(?: وبركاته)?)?"]),
  ...phrases("greeting", "bangla", [
    "হাই|হ্যালো|হেলো|হেল্লো|হাই হ্যালো|হ্যালো হাই|সুপ্রভাত",
    "শুভ (?:সকাল|সন্ধ্যা|দুপুর|বিকাল|বিকেল|অপরাহ্ন)",
  ]),
  ...phrases("greeting", "english", [
    "h+i+|he+l+o+|hel+ow|hlw|hlo|hey+|yo|howdy|greetings|gm",
    "(?:hi|hey|hello) there",
    "good (?:morning|afternoon|evening|day)|morning",
  ]),
  ...phrases("wellbeing", "bangla", [
    `(?:${BN_YOU} )?(?:কেমন|কেমুন) (?:আছ|আছো|আছেন|আছিস|আছে)(?: তো| সবাই)?`,
    `(?:${BN_YOU} )?ভালো আছ(?:ো|েন|িস)(?: তো)?`,
    `${BN_WHAT} (?:খবর|অবস্থা)(?: (?:তোমার|আপনার))?`,
  ]),
  ...phrases("wellbeing", "banglish", [
    `(?:${BL_YOU} )?(?:kemon|kmn|kamon|kemun) (?:acho|achen|aso|asen|achis|acos|aco|achhen|achho|asis)(?: to)?`,
    `(?:${BL_YOU} )?(?:valo|bhalo) (?:acho|achen|aso|asen)(?: to)?`,
    "(?:ki|kii) (?:khobor|khbr|obostha)",
  ]),
  ...phrases("wellbeing", "english", [
    `how (?:are|r) ${EN_YOU}(?: doing)?(?: today)?`,
    "how(?: is|s) it going|how do you do|whats up|wats up|what is up|sup|wassup",
  ]),
  ...phrases("identity", "bangla", [
    `${BN_YOU} (?:কে|কী|কি)(?: হও| হন| হস)?`,
    `${BN_YOUR} (?:নাম|পরিচয়)(?: ${BN_WHAT})?(?: (?:বলো|বলুন|বলেন|বল))?`,
    `(?:তুমি|আপনি) ${BN_WHAT} (?:এআই|রোবট|মানুষ|বট|চ্যাটবট|চ্যাটজিপিটি|মেশিন)`,
    `${BN_YOUR} (?:সম্পর্কে|ব্যাপারে) (?:কিছু )?(?:বলো|বলুন|বলেন)`,
    "(?:নিজের )?পরিচয় (?:দাও|দিন|দেন)|নিজের সম্পর্কে (?:বলো|বলুন)",
    `উসুল (?:এআই|এ আই) ${BN_WHAT}`,
  ]),
  ...phrases("identity", "banglish", [
    `${BL_YOU} (?:ke|k|ki)(?: hou| hon| hos)?`,
    `${BL_YOUR} (?:nam|name|naam|porichoy|porichoi|porichay)(?: (?:ki|kii|koi))?(?: (?:bolo|bolen|bol))?`,
    "(?:tumi|apni|tmi) (?:ki|kii) (?:ai|robot|manush|bot|chatbot|chatgpt|machine)",
    `${BL_YOUR} (?:somporke|shomporke|bepare) (?:kichu )?(?:bolo|bolen)`,
    "usul ?ai (?:ki|kii)",
  ]),
  ...phrases("identity", "english", [
    `(?:who|what) (?:are|r) ${EN_YOU}`,
    "(?:what is|whats) (?:your|ur) name|(?:your|ur) name",
    "introduce yourself|tell me about (?:yourself|you)|about you",
    `are ${EN_YOU} (?:an? )?(?:ai|bot|robot|human|chatbot|chatgpt|machine|real)`,
    "who am i (?:talking|speaking) (?:to|with)|who is this|what is this|whats this",
    "(?:what|who) is usul ?ai",
  ]),
  ...phrases("capabilities", "bangla", [
    `(?:তুমি|আপনি) ${BN_WHAT}(?: ${BN_WHAT})? (?:করতে পারো|করতে পারেন|পারো|পারেন|জানো|জানেন|করো|করেন|কাজ করো|কাজ করেন)`,
    `${BN_YOUR} কাজ ${BN_WHAT}`,
    "(?:তুমি|আপনি) কীভাবে (?:কাজ করো|কাজ করেন|সাহায্য করতে পারো|সাহায্য করতে পারেন)",
    `(?:তোমাকে|আপনাকে) ${BN_WHAT} (?:জিজ্ঞেস|প্রশ্ন) (?:করা যায়|করতে পারি)`,
    "সাহায্য|হেল্প",
  ]),
  ...phrases("capabilities", "banglish", [
    "(?:tumi|apni|tmi) (?:ki )?(?:ki|kii) (?:korte paro|korte paren|paro|paren|jano|janen|koro|koren|kaj koro|kaj koren)",
    `${BL_YOUR} kaj (?:ki|kii)`,
    "(?:tumi|apni) (?:kivabe|kibhabe) (?:kaj koro|kaj koren|help korte paro|sahajjo korte paro)",
  ]),
  ...phrases("capabilities", "english", [
    `what (?:can|could) ${EN_YOU} do(?: for me)?`,
    `what do ${EN_YOU} do|how do ${EN_YOU} work`,
    `how (?:can|could) ${EN_YOU} help(?: me)?`,
    "what are (?:your|ur) (?:features|capabilities|abilities)",
    "what can i ask(?: you)?|help",
  ]),
  ...phrases("creator", "bangla", [
    `${BN_YOU_OBJ} ${BN_WHO} ${BN_MADE}`,
    `${BN_WHO} ${BN_YOU_OBJ} ${BN_MADE}`,
    `${BN_YOUR} (?:নির্মাতা|ডেভেলপার|ডেভলপার|মালিক|প্রতিষ্ঠাতা|ক্রিয়েটর|প্রোগ্রামার|তৈরিকারী|নির্মাতারা) ${BN_WHO}`,
    "(?:তুমি|আপনি) (?:কার|কাদের) (?:তৈরি|বানানো)",
    `এই (?:অ্যাপ|এপ|সাইট|ওয়েবসাইট|বট|এআই) ${BN_WHO} ${BN_MADE}`,
    "ইমন কে",
  ]),
  ...phrases("creator", "banglish", [
    `${BL_YOU_OBJ} ${BL_WHO} ${BL_MADE}`,
    `${BL_WHO} ${BL_YOU_OBJ} ${BL_MADE}`,
    `${BL_YOUR} (?:creator|developer|nirmata|malik|owner|maker|dev|programmer|founder) ${BL_WHO}`,
    "(?:tumi|apni) (?:kar|kader) (?:toiri|banano|baniye)",
    "emon (?:ke|k)",
  ]),
  ...phrases("creator", "english", [
    `(?:who|whom) (?:made|created|built|developed|designed|programmed|coded|owns|trained|invented) (?:${EN_YOU}|this(?: app| bot| site| website| ai| assistant)?)`,
    "who (?:is|s|are) (?:your|ur) (?:creator|creators|developer|developers|maker|makers|owner|founder|author|programmer|dev|devs)",
    `who(?: is|s)? behind (?:${EN_YOU}|this(?: app| ai)?)`,
    "(?:your|ur) (?:creator|developer|maker|owner)",
    `(?:by whom|who) (?:were|was) (?:${EN_YOU}|this) (?:made|created|built|developed)(?: by)?`,
    "who is emon|whos emon",
  ]),
  ...phrases("thanks", "bangla", ["জা(?:য|জ)াকাল্লাহু?(?: খা(?:ই|য়)রা?ন?)?"], "jazakallah"),
  ...phrases("thanks", "bangla", ["(?:অনেক |অসংখ্য )?(?:ধন্যবাদ|শুকরিয়া)(?: (?:আপনাকে|তোমাকে))?"]),
  ...phrases(
    "thanks",
    "banglish",
    ["ja(?:z|j)a?kall?ah?u?(?: kh?air(?:an)?)?|jazakumull?ah(?: kh?air(?:an)?)?"],
    "jazakallah",
  ),
  ...phrases("thanks", "banglish", [
    "(?:onek |oshonkho )?(?:dhonnobad|donnobad|dhonyobad|dhonnobaad|shukriya|sukriya|shukria)",
  ]),
  ...phrases("thanks", "english", [
    "thanks?|thank (?:you|u)|thx|tnx|tq|ty",
    "thanks (?:a lot|so much)|thank you (?:so much|very much)|many thanks",
  ]),
  ...phrases("thanks", "arabic", ["جزاك الله خيرا?"], "jazakallah"),
  ...phrases("goodbye", "bangla", [
    "(?:আল্লাহ|আল্লা|খোদা) (?:হাফেজ|হাফিজ)|বিদায়|শুভ ?রাত্রি|ফি আমানিল্লাহ|আবার দেখা হবে",
  ]),
  ...phrases("goodbye", "banglish", ["(?:allah|khoda|khuda) (?:hafez|hafiz)|biday|fi amanillah"]),
  ...phrases("goodbye", "english", [
    "bye+|bye bye|goodbye|good bye|take care|good night|gn|tata|cya",
    `see ${EN_YOU}(?: later| soon)?`,
  ]),
];

const FILLER_WORDS = new Set(
  [
    "ভাই",
    "ভাইয়া",
    "আপু",
    "একটু",
    "প্লিজ",
    "জি",
    "জ্বি",
    "আচ্ছা",
    "হুজুর",
    "স্যার",
    "বন্ধু",
    "ওকে",
    "bhai",
    "vai",
    "bro",
    "brother",
    "apu",
    "sis",
    "sister",
    "please",
    "pls",
    "plz",
    "plzz",
    "ektu",
    "ji",
    "jee",
    "sir",
    "dear",
    "ok",
    "okay",
    "acha",
    "accha",
    "huzur",
    "kindly",
  ].map(composeNukta),
);

const PHRASE_FILLERS = ["দয়া করে", "can you tell me", "could you tell me", "do you know"].map(
  composeNukta,
);

function words(list: string): string[] {
  return composeNukta(list).split(/\s+/).filter(Boolean);
}

const COMMON = new Set(
  words(`
    আজ আজকে আজকের আজকার এখন এখনকার কত কতো কী কি কোন কয়টা কটা বলো বলুন বলেন বল দাও দিন জানাও জানান হবে হচ্ছে আছে টা এর র ে তে
    ajke aj ajker ajk ajkr akhon ekhon ekhn koto kto ki kii kon koyta kota bolo bolen bol dao din janao janan hobe hocche ache ase ta er r e te
    today todays now current currently right what whats which is are it the s of in at for me tell will be like how give show please
  `),
);

const BANGLISH_WORDS = new Set(
  words(`
    ajke aj ajker ajk ajkr akhon ekhon ekhn koto kto ki kii kon koyta kota bolo bolen bol dao din janao janan hobe hocche ache ase ta er te
    tarikh tarik tarikhta bar barta somoy shomoy baje bajhe bajlo abohawa abhawa obohawa abohaoa tapmatra brishti bristi kemon kmn kal agamikal
    namaz namazer namaj namajer nmaz waqt oakto oyakto somoysuchi kokhon koytay shesh shuru hoy sehri sehrir sahri iftar iftarer fojor fozor johor asor esha
    arabi mash sal bochor
    namajer namazer fazilat fazilot fojilot fozilot gurutto guruttho rakat rakater oyakto wakto porer porborti ekhon cholche baki
    romjan romzan ramzan roja roza rojar rozar niyat niyot dua doa iftarer seheri seherir kobe tomo
    hozz hozzer hazz hazzer hojj hajjer jakat jakater zakater nisab nishab poriman hisab hisheb hiseb
    kalima kalimar kalema ortho mane ucharon sona rupa taka lakh hazar vori bhori amar ache ase dite lagbe
  `),
);

const DATE_REQUIRED = words("তারিখ তারিখটা তাং date tarikh tarik tarikhta");
const DAY_REQUIRED = words("বার বারটা day weekday bar barta");
const TIME_REQUIRED = words("সময় বাজে বাজলো ঘড়ি time baje bajhe bajlo somoy shomoy clock");
const WEATHER_REQUIRED = words(`
  আবহাওয়া আবহাওয়ার আবহাওয়াটা তাপমাত্রা তাপমাত্রার বৃষ্টি বৃষ্টির পূর্বাভাস
  weather wether temperature temp forecast rain raining abohawa abhawa obohawa abohaoa tapmatra brishti bristi
`);
const PRAYER_WORDS = words(`
  নামাজ নামাজের নামায নামাযের সালাত সালাতের namaz namazer namaj namajer nmaz salat salater salah prayer prayers
`);
const PRAYER_TIME_WORDS = words(`
  সময় সময়সূচি সময়সূচী সূচি ওয়াক্ত ওয়াক্তের কখন কয়টায় শুরু শেষ
  somoy shomoy somoysuchi time times timing timings schedule waqt oakto oyakto kokhon koytay when shuru shesh start starts begin begins end ends last
`);

const PRAYER_NAMES: Record<string, PrayerKey> = Object.fromEntries(
  (
    [
      ["fajr", "ফজর ফজরের fajr fajor fojor fozor fazr"],
      ["dhuhr", "যোহর যোহরের জোহর জোহরের জুহর dhuhr zuhr zohr johor juhr duhr"],
      ["asr", "আসর আসরের asr asor asar"],
      ["maghrib", "মাগরিব মাগরিবের magrib maghrib magrib"],
      ["isha", "এশা এশার ইশা ইশার esha isha ishaa"],
      ["sehri", "সেহরি সেহরির সাহরি সাহরির sehri sehrir seheri seherir sahri sahur suhoor suhur"],
      ["iftar", "ইফতার ইফতারের iftar iftarer iftari"],
    ] as const
  ).flatMap(([key, list]) => words(list).map((word) => [word, key] as const)),
);

interface TokenIntentSpec {
  intent: Exclude<GeneralIntent, PhraseIntent | "zakatCalc">;
  groups: Set<string>[];
  allowed: Set<string>;
  flags?: Record<string, string>;
  placeAware: boolean;
  variant?: (tokens: string[]) => string | undefined;
  also?: (tokens: string[]) => GeneralIntent[];
}

function flagMap(flag: string, list: string): Record<string, string> {
  return Object.fromEntries(words(list).map((word) => [word, flag]));
}

function variantMap(entries: [string, string][]): Record<string, string> {
  return Object.fromEntries(
    entries.flatMap(([variant, list]) => words(list).map((word) => [word, variant])),
  );
}

const KNOWLEDGE_COMMON = words(`
  সম্পর্কে ও আর এবং সহ বলো বলুন লিখে লিখো দাও দিন জানাও জানান সব সবগুলো গুলো তালিকা কয়টি কয়টা আমাকে বিস্তারিত ইসলামে ইসলামের কে কারা
  somporke shomporke about o ar and soho with likho likhe dao janao sob sobgulo gulo list koyti amake details bistarito
  are explain many much all islam islame islamer to a an do does can there
`);
const MEANING_WORDS = words(
  "অর্থ অর্থসহ মানে ortho orthosoho mane meaning meanings translation অনুবাদ onubad",
);
const PRONUNCIATION_WORDS = words(
  "উচ্চারণ উচ্চারণসহ ucharon uccharon ucharonsoho pronunciation transliteration",
);
const KALIMA_WORDS = words(`
  কালিমা কালেমা কালিমার কালেমার কলেমা কালিমাগুলো
  kalima kalema kalimah kolima kalma kalimar kalemar kolimar kalimas kalmas kalimagulo
`);
const KALIMA_VARIANTS = variantMap([
  [
    "1",
    "তাইয়্যেবা তাইয়্যিবা তৈয়্যবা তাইয়েবা তৈয়বা tayyiba tayyeba taiyaba toiyoba tayeba toyyiba tayyibah প্রথম ১ম first 1st prothom",
  ],
  ["2", "শাহাদাত শাহাদত shahadat shahadah shahadot দ্বিতীয় ২য় second 2nd ditiyo dwitiyo"],
  ["3", "তাওহীদ তাওহিদ তৌহিদ tawhid tawheed tauhid touhid তৃতীয় ৩য় third 3rd tritiyo"],
  ["4", "তামজীদ তামজিদ tamjid tamjeed চতুর্থ ৪র্থ fourth 4th choturtho"],
  ["5", "রদ্দে রাদ্দে radde radd পঞ্চম ৫ম fifth 5th ponchom"],
]);
const KALIMA_ALLOWED = words("কুফর kufr kufor পাঁচ ৫ 5 panch pach five ছয় ৬ 6 six");
const FAZILAT_WORDS = words(`
  ফজিলত ফজিলতসমূহ ফযীলত ফযিলত ফজীলত সওয়াব ছওয়াব উপকারিতা মর্যাদা
  fazilat fazilot fojilot fozilot fojilat fadilat fadilah fadail sowab sawab virtue virtues benefit benefits reward rewards merit merits interesting excellence
`);
const IMPORTANCE_WORDS = words(`
  গুরুত্ব গুরুত্বপূর্ণ তাৎপর্য প্রয়োজনীয়তা কেন কেনো
  gurutto guruttho gurotto gurutwo importance important significance tatporjo why keno
`);
const RAKAT_WORDS = words(`
  রাকাত রাকআত রাকাআত রাকাতের
  rakat rakaat rakah rakats rakahs raka rakaats rakater rakat
`);
const RAKAT_VARIANTS = {
  ...Object.fromEntries(
    Object.entries({
      fajr: "ফজর ফজরের fajr fajor fojor fozor fojorer fozorer fajrer",
      dhuhr: "যোহর যোহরের জোহর জোহরের জুহর dhuhr zuhr zohr johor juhr duhr johorer zohorer",
      asr: "আসর আসরের asr asor asar asorer asrer",
      maghrib: "মাগরিব মাগরিবের magrib maghrib magriber maghriber",
      isha: "এশা এশার ইশা ইশার esha isha ishaa eshar ishar",
      jumua: "জুমা জুম্মা জুমার জুম্মার জুমআ jumma jumua juma jummah jumar jummar friday",
      witr: "বিতর বেতের বিতরের witr witir beter bitir vitr betor",
    }).flatMap(([variant, list]) => words(list).map((word) => [word, variant])),
  ),
} as Record<string, string>;
const RULING_WORDS = words(`
  ফরজ ফরয সুন্নাত সুন্নত ওয়াজিব নফল মোট নামাজ নামাজের নামায নামাযের
  foroj farz fard fardh sunnat sunnah wajib nafl nofol mot total namaz namaj namazer namajer salah salat prayer prayers
`);
const NOW_WORDS = words(
  "এখন বর্তমান চলছে চলমান কোন ekhon akhon currently current now cholche choltese running kon which ongoing",
);
const NEXT_WORDS = words(`
  পরবর্তী পরের পরে কতক্ষণ বাকি আগামী
  next porer porborti porboti upcoming koto-khon kotokkhon baki remaining left
`);
const WAQT_WORDS = words(
  "ওয়াক্ত ওয়াক্তের সময় waqt wakt wakto oakto oyakto waqto time somoy shomoy",
);
const ROZA_WORDS = words(`
  রোজা রোযা রোজার রোযার সিয়াম সওম রমজান রমযান রমজানের রমযানের রামাদান রামাদানের
  roja roza rojar rozar rozah sawm siyam fasting fast fasts ramadan ramzan romjan romzan ramjan ramadhan romjaner ramadaner ramzaner romjanr
`);
const RAMADAN_WHEN_WORDS = words(`
  কবে কত দিন বাকি পর শুরু কততম তম তারিখ আজ আজকে আর তো
  kobe koto din baki por shuru suru start starts begin begins when days day left remaining countdown today aj ajke date tarikh till until tomo ar
`);
const NIYAT_WORDS = words(
  "নিয়ত নিয়্যত নিয়াত নিয়তের niyat niyot neeyat niyyah niyyat intention niat nioth",
);
const IFTAR_WORDS = words("ইফতার ইফতারের iftar iftarer iftari");
const SEHRI_WORDS = words(
  "সেহরি সেহরির সাহরি সাহরির sehri sehrir seheri seherir sahri suhoor suhur",
);
const DUA_WORDS = words("দোয়া দুআ দুয়া doa dua duaa dowa supplication");
const HAJJ_WORDS = words(`
  হজ হজ্জ হজ্ব হজের হজ্জের হজ্বের হজ্জ্ব
  hajj haj hajjer hajer hojj hoj hozz hazz hozzer hazzer hojjer hojer pilgrimage
`);
const HAJJ_WHEN_WORDS = words(`
  কবে পরবর্তী পরের তারিখ কত দিন আজ আজকে কোন কততম তম বাকি শুরু আর
  kobe next porer porborti date tarikh koto din aj ajke kon tomo baki when day days today which shuru start upcoming ar
`);
const ZAKAT_WORDS = words("যাকাত জাকাত যাকাতের জাকাতের zakat zakah jakat jakater zakater zakaat");
const NISAB_WORDS = words("নিসাব নেসাব নিসাবের nisab nishab nisaab nesab threshold");
const RATE_WORDS = words(`
  পরিমাণ পরিমান হার শতাংশ পার্সেন্ট percent percentage poriman porimam rate har shotangsho kotto
`);
const CALC_WORDS = words(`
  হিসাব হিসেব হিসাবে হিসেবে হিসাবের ক্যালকুলেটর ক্যালকুলেশন বের
  hisab hisheb hiseb hisebe hisabe hishab calculate calculator calculation calc compute ber
`);
const METAL_WORDS = words(
  "সোনা স্বর্ণ রুপা রূপা সোনার স্বর্ণের রুপার gold silver sona rupa sonar rupar taka টাকা টাকায়",
);

const KNOWLEDGE_SPECS: TokenIntentSpec[] = [
  {
    intent: "kalima",
    groups: [new Set(KALIMA_WORDS)],
    allowed: new Set([
      ...KNOWLEDGE_COMMON,
      ...Object.keys(KALIMA_VARIANTS),
      ...KALIMA_ALLOWED,
      ...MEANING_WORDS,
      ...PRONUNCIATION_WORDS,
      ...FAZILAT_WORDS,
    ]),
    flags: {
      ...flagMap("fazilat", FAZILAT_WORDS.join(" ")),
      ...flagMap("meaning", [...MEANING_WORDS, ...PRONUNCIATION_WORDS].join(" ")),
    },
    placeAware: false,
    variant: (tokens) => tokens.map((token) => KALIMA_VARIANTS[token]).find(Boolean),
  },
  {
    intent: "rakat",
    groups: [new Set(RAKAT_WORDS)],
    allowed: new Set([...KNOWLEDGE_COMMON, ...Object.keys(RAKAT_VARIANTS), ...RULING_WORDS]),
    placeAware: false,
    variant: (tokens) => tokens.map((token) => RAKAT_VARIANTS[token]).find(Boolean),
  },
  {
    intent: "salahFazilat",
    groups: [new Set(PRAYER_WORDS), new Set(FAZILAT_WORDS)],
    allowed: new Set([...KNOWLEDGE_COMMON, ...IMPORTANCE_WORDS]),
    placeAware: false,
    also: (tokens) =>
      tokens.some((token) => IMPORTANCE_WORDS.includes(token)) ? ["salahImportance"] : [],
  },
  {
    intent: "salahImportance",
    groups: [new Set(PRAYER_WORDS), new Set(IMPORTANCE_WORDS)],
    allowed: new Set(KNOWLEDGE_COMMON),
    placeAware: false,
  },
  {
    intent: "currentPrayer",
    groups: [
      new Set([...NOW_WORDS, ...NEXT_WORDS]),
      new Set([...WAQT_WORDS, ...PRAYER_WORDS, ...Object.keys(PRAYER_NAMES)]),
    ],
    allowed: new Set([
      ...PRAYER_TIME_WORDS,
      ...words("হবে hobe পর por শেষ ses shesh আসবে asbe starts will is it"),
    ]),
    placeAware: true,
  },
  {
    intent: "sawmNiyat",
    groups: [new Set(NIYAT_WORDS), new Set([...ROZA_WORDS, ...SEHRI_WORDS])],
    allowed: new Set([...KNOWLEDGE_COMMON, ...IFTAR_WORDS, ...DUA_WORDS]),
    placeAware: false,
    also: (tokens) => (tokens.some((token) => IFTAR_WORDS.includes(token)) ? ["iftarDua"] : []),
  },
  {
    intent: "iftarDua",
    groups: [new Set(IFTAR_WORDS), new Set([...DUA_WORDS, ...NIYAT_WORDS])],
    allowed: new Set([...KNOWLEDGE_COMMON, ...ROZA_WORDS]),
    placeAware: false,
  },
  {
    intent: "sawmFazilat",
    groups: [new Set(ROZA_WORDS), new Set([...FAZILAT_WORDS, ...IMPORTANCE_WORDS])],
    allowed: new Set(KNOWLEDGE_COMMON),
    placeAware: false,
  },
  {
    intent: "ramadan",
    groups: [new Set(ROZA_WORDS), new Set(RAMADAN_WHEN_WORDS)],
    allowed: new Set(KNOWLEDGE_COMMON),
    placeAware: false,
  },
  {
    intent: "hajjFazilat",
    groups: [new Set(HAJJ_WORDS), new Set([...FAZILAT_WORDS, ...IMPORTANCE_WORDS])],
    allowed: new Set(KNOWLEDGE_COMMON),
    placeAware: false,
  },
  {
    intent: "hajj",
    groups: [new Set(HAJJ_WORDS), new Set(HAJJ_WHEN_WORDS)],
    allowed: new Set(KNOWLEDGE_COMMON),
    flags: flagMap("today", "আজ আজকে aj ajke today tomo তম কততম"),
    placeAware: false,
  },
  {
    intent: "zakatNisab",
    groups: [new Set(ZAKAT_WORDS), new Set(NISAB_WORDS)],
    allowed: new Set([...KNOWLEDGE_COMMON, ...METAL_WORDS, ...RATE_WORDS]),
    placeAware: false,
    also: (tokens) => (tokens.some((token) => RATE_WORDS.includes(token)) ? ["zakatRate"] : []),
  },
  {
    intent: "zakatRate",
    groups: [new Set(ZAKAT_WORDS), new Set(RATE_WORDS)],
    allowed: new Set([...KNOWLEDGE_COMMON, ...words("দিতে হয় dite hoy hobe হবে ba বা or")]),
    placeAware: false,
  },
  {
    intent: "zakatFazilat",
    groups: [new Set(ZAKAT_WORDS), new Set([...FAZILAT_WORDS, ...IMPORTANCE_WORDS])],
    allowed: new Set(KNOWLEDGE_COMMON),
    placeAware: false,
  },
];

const ZAKAT_CALC_ALLOWED = new Set([
  ...ZAKAT_WORDS,
  ...CALC_WORDS,
  ...RATE_WORDS,
  ...ZAKAT_AMOUNT_WORDS,
  ...KNOWLEDGE_COMMON,
  ...words(`
    আমার আমাদের কাছে আছে আছেন মোট কত হবে দিতে দিব দেব দেওয়া লাগবে করুন করো করে দিন দাও আরও এর র তে এ কী কি মত মতো রয়েছে বছর
    amar amader kache kase ache ase achhe mot total koto hobe dite dibo debo deya lagbe korun koro kore den dao aro er r te e ki moto royeche bochor
    i my have has own owns is due pay payable of on for the how much what me please calculate also
  `),
]);

const TOKEN_INTENTS: TokenIntentSpec[] = [
  ...KNOWLEDGE_SPECS,
  {
    intent: "prayer",
    groups: [new Set([...PRAYER_WORDS, ...Object.keys(PRAYER_NAMES)])],
    allowed: new Set([...PRAYER_TIME_WORDS, ...words("হয় hoy do does is the")]),
    placeAware: true,
  },
  {
    intent: "weather",
    groups: [new Set(WEATHER_REQUIRED)],
    allowed: new Set(
      words(`
        কেমন রিপোর্ট ডিগ্রি সেলসিয়াস কাল আগামীকাল হবেকি গরম ঠান্ডা
        kemon kmn report degree degrees celsius kal agamikal tomorrow tmrw going to gonna outside there hot cold
      `),
    ),
    flags: {
      ...flagMap("tomorrow", "কাল আগামীকাল kal agamikal tomorrow tmrw"),
      ...flagMap("rain", "বৃষ্টি বৃষ্টির rain raining brishti bristi"),
    },
    placeAware: true,
  },
  {
    intent: "date",
    groups: [new Set(DATE_REQUIRED)],
    allowed: new Set([
      ...DAY_REQUIRED,
      ...words(`
        ইংরেজি বাংলা হিজরি আরবি ইসলামিক চান্দ্র চাঁদের মাস সাল বছর সন আর ও এবং
        english bangla bengali bangali hijri hijiri arabi arabic islamic chander month mash year sal bochor and o full
      `),
    ]),
    flags: {
      ...flagMap(
        "hijri",
        "হিজরি আরবি ইসলামিক চান্দ্র চাঁদের hijri hijiri arabi arabic islamic chander",
      ),
      ...flagMap("bangla", "বাংলা bangla bengali bangali"),
    },
    placeAware: false,
  },
  {
    intent: "day",
    groups: [new Set(DAY_REQUIRED)],
    allowed: new Set(words("সপ্তাহের week weekday of")),
    placeAware: false,
  },
  {
    intent: "time",
    groups: [new Set(TIME_REQUIRED)],
    allowed: new Set(words("কয়টা কটা বাজে koyta kota baje local exact o'clock ঠিক thik")),
    placeAware: true,
  },
];

const BLOCKED_WORDS = new Set(
  words(`
    হারাম হালাল জায়েজ জায়েয নাজায়েজ মাকরুহ ফরজ ফরয ওয়াজিব সুন্নত সুন্নাত নফল ওযু অজু গোসল রোজা রোযা হজ হজ্জ যাকাত কুরআন হাদিস হাদীস মাসআলা হুকুম কাজা কাযা কসর ভঙ্গ ভাঙবে পড়া পড়তে পড়লে পড়বো ইসলাম ইসলামে শরিয়ত শরীয়তে যাবে যায় কেন কেনো
    islam islamic shariah sharia jabe jay keno why allowed permissible
    haram halal jayez jaiz najayez makruh foroj farz wajib sunnat sunnah nafl oju ozu wudu gosol roja roza rojar hajj zakat quran hadith hadis masala masaala hukum kaza qaza qasr kosor vongo porte porle porbo pora
  `),
);

const LOCATIVE_WORDS = new Set(words("in at এ te e er এর"));

export function normalizeUtterance(text: string): string {
  let value = composeNukta(text.normalize("NFC")).toLowerCase();
  value = value.replace(/[ً-ٰٟـ]/g, "");
  value = value.replace(/['’‘`]/g, "");
  value = value.replace(/([\d০-৯]),(?=[\d০-৯])/g, "$1");
  value = value.replace(/[^\p{L}\p{N}\p{M}\s.]/gu, " ");
  value = value.replace(/(?<![\d০-৯])\.|\.(?![\d০-৯])/g, " ");
  for (const filler of PHRASE_FILLERS) value = ` ${value} `.split(` ${filler} `).join(" ");
  return value.replace(/\s+/g, " ").trim();
}

function tokensOf(text: string): string[] {
  return normalizeUtterance(text)
    .split(" ")
    .filter((word) => word.length > 0 && !FILLER_WORDS.has(word));
}

function matchPhrase(tokens: string[]): PhrasePattern | null {
  if (tokens.length === 0) return null;
  const text = tokens.join(" ");
  return PHRASES.find((entry) => entry.pattern.test(text)) ?? null;
}

interface TokenMatch {
  clauses: DetectedClause[];
  banglish: boolean;
}

function specAccepts(spec: TokenIntentSpec, tokens: string[]): string[] | null {
  if (!spec.groups.every((group) => tokens.some((token) => group.has(token)))) return null;
  if (spec.intent === "prayer") {
    const hasTime = tokens.some((token) => PRAYER_TIME_WORDS.includes(token));
    const named = tokens.some((token) => PRAYER_NAMES[token] !== undefined);
    if (!hasTime && !(named && tokens.length <= 3)) return null;
  }
  if (spec.intent === "day" && tokens.some((token) => DATE_REQUIRED.includes(token))) return null;

  const residual = tokens.filter(
    (token) =>
      !spec.groups.some((group) => group.has(token)) &&
      !spec.allowed.has(token) &&
      !COMMON.has(token),
  );
  if (residual.some((token) => BLOCKED_WORDS.has(token))) return null;
  if (residual.length > 0 && !spec.placeAware) return null;
  if (residual.length > GENERAL_ASSISTANT_CONFIG.maxPlaceWords) return null;
  return residual;
}

function matchTokenIntent(tokens: string[]): TokenMatch | null {
  for (const spec of TOKEN_INTENTS) {
    const residual = specAccepts(spec, tokens);
    if (residual === null) continue;

    const flags = [
      ...new Set(tokens.map((token) => spec.flags?.[token]).filter((flag) => flag !== undefined)),
    ];
    const prayer = tokens.map((token) => PRAYER_NAMES[token]).find((key) => key !== undefined);
    const variant = spec.variant?.(tokens);
    const base: DetectedClause = {
      intent: spec.intent,
      ...(variant ? { variant } : {}),
      placeWords: residual,
      flags,
      ...(spec.intent === "prayer" && prayer ? { prayer } : {}),
      explicitLocation: tokens.some((token) => LOCATIVE_WORDS.has(token)),
    };
    const extra = (spec.also?.(tokens) ?? []).map((intent) => ({ ...base, intent }));

    return {
      clauses: [base, ...extra],
      banglish: tokens.some((token) => BANGLISH_WORDS.has(token)),
    };
  }
  return null;
}

interface ClauseMatch {
  clauses: DetectedClause[];
  banglish: boolean;
}

function phraseClause(entry: PhrasePattern): DetectedClause {
  return {
    intent: entry.intent,
    ...(entry.variant ? { variant: entry.variant } : {}),
    placeWords: [],
    flags: [],
    explicitLocation: false,
  };
}

function matchClause(tokens: string[], depth = 0): ClauseMatch | null {
  if (tokens.length === 0) return { clauses: [], banglish: false };
  if (tokens.length > GENERAL_ASSISTANT_CONFIG.maxClauseWords) return null;

  const phrase = matchPhrase(tokens);
  if (phrase) return { clauses: [phraseClause(phrase)], banglish: phrase.script === "banglish" };

  const token = matchTokenIntent(tokens);
  if (token) return token;

  if (depth > 1) return null;
  for (let split = Math.min(tokens.length - 1, 8); split >= 1; split -= 1) {
    const head = matchPhrase(tokens.slice(0, split));
    if (!head) continue;
    const rest = matchClause(tokens.slice(split), depth + 1);
    if (!rest || rest.clauses.length === 0) continue;
    return {
      clauses: [phraseClause(head), ...rest.clauses],
      banglish: head.script === "banglish" || rest.banglish,
    };
  }
  return null;
}

function matchZakatCalculation(tokens: string[]): DetectedClause | null {
  if (tokens.length === 0 || tokens.length > GENERAL_ASSISTANT_CONFIG.maxZakatWords) return null;
  if (!tokens.some((token) => ZAKAT_WORDS.includes(token))) return null;
  const numeric = tokens.some(isAmountToken);
  if (!numeric && !tokens.some((token) => CALC_WORDS.includes(token))) return null;
  if (
    !tokens.every(
      (token) => isAmountToken(token) || ZAKAT_CALC_ALLOWED.has(token) || COMMON.has(token),
    )
  ) {
    return null;
  }
  const { assets, found } = parseZakatAssets(tokens);
  return {
    intent: "zakatCalc",
    placeWords: [],
    flags: [],
    explicitLocation: false,
    ...(found ? { assets } : {}),
  };
}

const ORDER: GeneralIntent[] = [
  "salam",
  "salamReply",
  "greeting",
  "wellbeing",
  "identity",
  "creator",
  "capabilities",
  "date",
  "day",
  "time",
  "weather",
  "kalima",
  "salahImportance",
  "salahFazilat",
  "rakat",
  "currentPrayer",
  "prayer",
  "ramadan",
  "sawmNiyat",
  "iftarDua",
  "sawmFazilat",
  "hajj",
  "hajjFazilat",
  "zakatNisab",
  "zakatRate",
  "zakatCalc",
  "zakatFazilat",
  "thanks",
  "goodbye",
];

const TOPIC_WORDS = new Set([
  ...KALIMA_WORDS,
  ...PRAYER_WORDS,
  ...ROZA_WORDS,
  ...HAJJ_WORDS,
  ...ZAKAT_WORDS,
]);

const CLAUSE_BREAK = /[;।!?\n؟]+|(?<![\d০-৯])[,.،]|[,.،](?![\d০-৯])/u;

function languageOf(question: string, banglish: boolean, conversationBangla: boolean): ReplyLang {
  const bengaliScript = /[ঀ-৿]/u.test(question);
  const arabicOnly = /[؀-ۿ]/u.test(question) && !/[a-z]/i.test(question);
  return bengaliScript || arabicOnly || banglish || conversationBangla ? "bn" : "en";
}

function zakatDetection(
  pieces: string[][],
  question: string,
  conversationBangla: boolean,
): GeneralDetection | null {
  const social: DetectedClause[] = [];
  const rest: string[] = [];
  let banglish = false;
  for (const piece of pieces) {
    const phrase = matchPhrase(piece);
    if (phrase && rest.length === 0) {
      social.push(phraseClause(phrase));
      banglish ||= phrase.script === "banglish";
      continue;
    }
    if (rest.length > 0) rest.push("and");
    rest.push(...piece);
  }
  const zakat = matchZakatCalculation(rest);
  if (!zakat) return null;
  banglish ||= rest.some((token) => BANGLISH_WORDS.has(token));
  return { lang: languageOf(question, banglish, conversationBangla), clauses: [...social, zakat] };
}

export function detectGeneral(
  question: string,
  conversationBangla = false,
): GeneralDetection | null {
  if (!GENERAL_ASSISTANT_CONFIG.enabled) return null;
  const pieces = question
    .split(CLAUSE_BREAK)
    .map((piece) => tokensOf(piece ?? ""))
    .filter((piece) => piece.length > 0);
  if (pieces.length === 0) return null;

  const zakat = zakatDetection(pieces, question, conversationBangla);
  if (zakat) return zakat;
  if (pieces.length > GENERAL_ASSISTANT_CONFIG.maxClauses) return null;

  const clauses: DetectedClause[] = [];
  let banglish = false;
  let topic: string | null = null;
  for (const piece of pieces) {
    const withTopic = topic && !piece.includes(topic) ? matchClause([topic, ...piece]) : null;
    const contextual =
      withTopic && withTopic.clauses.every((clause) => clause.placeWords.length === 0)
        ? withTopic
        : null;
    const match = (piece.length <= 3 ? contextual : null) ?? matchClause(piece) ?? contextual;
    if (!match) return null;
    clauses.push(...match.clauses);
    banglish ||= match.banglish;
    topic = piece.find((token) => TOPIC_WORDS.has(token)) ?? topic;
  }
  if (clauses.length === 0) return null;

  const merged = new Map<string, DetectedClause>();
  for (const clause of clauses) {
    const key = `${clause.intent}:${clause.placeWords.join(" ")}:${clause.prayer ?? ""}:${clause.variant ?? ""}`;
    const existing = merged.get(key);
    if (existing) existing.flags = [...new Set([...existing.flags, ...clause.flags])];
    else merged.set(key, { ...clause, flags: [...clause.flags] });
  }
  const unique = [...merged.values()].sort(
    (left, right) => ORDER.indexOf(left.intent) - ORDER.indexOf(right.intent),
  );

  return { lang: languageOf(question, banglish, conversationBangla), clauses: unique };
}
