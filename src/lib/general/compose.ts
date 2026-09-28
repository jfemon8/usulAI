import { DATE_TIME_CONFIG, GENERAL_ASSISTANT_CONFIG, SITE_NAME } from "@/config/site";
import {
  addDays,
  bengaliCalendarDate,
  bengaliLabel,
  clockLabel,
  gregorianLabel,
  hijriCalendarDate,
  hijriLabel,
  localDigits,
  parseClock,
  spokenClock,
  weekdayOf,
  WEEKDAYS,
  type CalendarDate,
  type Lang,
} from "@/lib/general/calendar";
import { detectGeneral, type DetectedClause, type PrayerKey } from "@/lib/general/intents";
import {
  hajjFazilatSection,
  iftarDuaSection,
  kalimaSection,
  rakatSection,
  salahFazilatSection,
  salahImportanceSection,
  sawmFazilatSection,
  sawmNiyatSection,
  zakatFazilatSection,
  zakatRateSection,
} from "@/lib/general/knowledge";
import {
  fetchPrayerTimes,
  fetchWeather,
  type PrayerTimings,
  type WeatherDay,
} from "@/lib/general/liveData";
import { DEFAULT_PLACE, findKnownPlace, placeName, resolvePlace } from "@/lib/general/places";
import {
  currentPrayerSection,
  hajjSection,
  ramadanSection,
  zakatCalcSection,
  zakatNisabSection,
} from "@/lib/general/seasonal";
import {
  citedReferences,
  minutesOf,
  pick,
  placeFor,
  PRAYER_ROWS,
  prayerClock,
  todayIn,
  unavailable,
  type Context,
  type Section,
} from "@/lib/general/section";
import type { GeneralBlock, GeneralCardRow, GeneralInfo, GeneralIntent } from "@/types";

export interface GeneralAnswer {
  text: string;
  info: GeneralInfo;
  evidence: string[];
}

const { creator, banglaName } = GENERAL_ASSISTANT_CONFIG;
const CREATOR_LINK = `**[${creator.name}](${creator.url})**`;
const SOCIAL: GeneralIntent[] = ["salam", "salamReply", "greeting", "wellbeing"];

const SALAM_ARABIC = "وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ";

function offsetLabel(timeZone: string, now: Date): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((entry) => entry.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

function socialSection(clause: DetectedClause, lang: Lang): Section {
  switch (clause.intent) {
    case "salam":
      return {
        text: `${SALAM_ARABIC}\n\n${pick(
          lang,
          "ওয়া আলাইকুমুস সালাম ওয়া রাহমাতুল্লাহি ওয়া বারাকাতুহ।",
          "Wa alaikumus salam wa rahmatullahi wa barakatuh.",
        )}`,
      };
    case "salamReply":
      return {
        text: pick(
          lang,
          "জাযাকাল্লাহু খাইরান! আল্লাহ আপনার ওপরও তাঁর রহমত ও বরকত নাযিল করুন।",
          "JazakAllahu khairan! May Allah's mercy and blessings be upon you too.",
        ),
      };
    case "greeting":
      return {
        text: pick(
          lang,
          `আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ! আমি **${banglaName}**।`,
          `Assalamu alaikum wa rahmatullah! I'm **${SITE_NAME}**.`,
        ),
      };
    case "wellbeing":
      return {
        text: pick(
          lang,
          "আলহামদুলিল্লাহ, ভালো আছি। জিজ্ঞেস করার জন্য জাযাকাল্লাহু খাইরান! আশা করি আপনিও আল্লাহর রহমতে ভালো আছেন।",
          "Alhamdulillah, I'm doing well, and thank you for asking! I hope you are well too, by the grace of Allah.",
        ),
      };
    case "identity":
      return {
        text: pick(
          lang,
          `আমি **${banglaName} (${SITE_NAME})**, কুরআন, হাদিস, ইজমা, কিয়াস, সীরাত ও ফিকহের নির্ভরযোগ্য কিতাবের দলিলের ভিত্তিতে ইসলামি প্রশ্নের উত্তর দেওয়ার একটি সহকারী।

- প্রতিটি উত্তরের সাথে সূত্র দিই, যা খুলে মূল পাঠ মিলিয়ে দেখা যায়
- দলিল না পেলে নিজে থেকে কিছু বানিয়ে বলি না, সরাসরি জানিয়ে দিই
- বাংলা, English ও Banglish, যেকোনো ভাষায় প্রশ্ন করা যায়
- আজকের তারিখ (ইংরেজি, বাংলা ও হিজরি), সময়, আবহাওয়া এবং নামাজের সময়সূচিও জানাতে পারি

আমাকে তৈরি করেছেন ${CREATOR_LINK}।`,
          `I'm **${SITE_NAME}**, an assistant that answers Islamic questions from the evidence in the Quran, Hadith, ijma, qiyas, sirah and classical fiqh books.

- Every answer comes with its sources, which you can open to check the original text
- When I find no evidence, I say so rather than make something up
- You can ask in English, Bangla or Banglish
- I can also tell you today's date (Gregorian, Bengali and Hijri), the time, the weather and prayer times

I was built by ${CREATOR_LINK}.`,
        ),
      };
    case "capabilities":
      return {
        text: pick(
          lang,
          `আমি যা যা করতে পারি:

- **দলিলভিত্তিক উত্তর:** কুরআন, হাদিস, ইজমা, কিয়াস, সীরাত ও ফিকহের কিতাব থেকে সূত্রসহ উত্তর; প্রতিটি সূত্র খুলে মূল পাঠ দেখা যায়
- **আরবি উদ্ধৃতি:** আয়াত ও হাদিসের আরবির সাথে বাংলা উচ্চারণ ও অর্থ
- **দৈনন্দিন তথ্য:** আজকের তারিখ (ইংরেজি, বাংলা ও হিজরি), বার, সময়, যেকোনো শহরের আবহাওয়া, এবং নামাজ, সেহরি ও ইফতারের সময়
- **তিন ভাষা:** বাংলা, English বা Banglish, যেভাবে সুবিধা লিখুন

যেমন জিজ্ঞেস করতে পারেন: “যাকাতের নিসাব কত?”, “আজকের নামাজের সময়সূচি”, “চট্টগ্রামের আবহাওয়া কেমন?”`,
          `Here is what I can do:

- **Evidence-based answers:** Islamic questions answered from the Quran, Hadith, ijma, qiyas, sirah and fiqh books, with every source openable to its original text
- **Arabic quotations:** each ayah or hadith with its pronunciation and meaning
- **Daily essentials:** today's date (Gregorian, Bengali and Hijri), the day, the time, the weather in any city, and prayer, sehri and iftar times
- **Three languages:** English, Bangla or Banglish, whichever you prefer

For example: "What is the nisab of zakat?", "Prayer times today", "Weather in London".`,
        ),
      };
    case "creator":
      return {
        text: pick(
          lang,
          `আমাকে তৈরি করেছেন ${CREATOR_LINK}। তাঁর কাজ ও পরিচিতি দেখতে নামের ওপর ক্লিক করুন।`,
          `I was built by ${CREATOR_LINK}. Click the name to visit the website.`,
        ),
        card: {
          kind: "creator",
          lang,
          eyebrow: pick(lang, "নির্মাতা", "Created by"),
          headline: creator.name,
          headlineHref: creator.url,
          subline: pick(
            lang,
            `${banglaName}-এর নির্মাতা ও ডেভেলপার`,
            `Creator and developer of ${SITE_NAME}`,
          ),
          link: { label: pick(lang, "ওয়েবসাইট দেখুন", "Visit website"), href: creator.url },
        },
      };
    case "thanks":
      return {
        text:
          clause.variant === "jazakallah"
            ? pick(
                lang,
                "ওয়া ইয়্যাকুম! আল্লাহ আপনাকেও উত্তম প্রতিদান দিন। আরও কোনো প্রশ্ন থাকলে নির্দ্বিধায় জিজ্ঞেস করুন।",
                "Wa iyyakum! May Allah reward you too. Feel free to ask anything else.",
              )
            : pick(
                lang,
                "আপনাকেও ধন্যবাদ! আরও কোনো প্রশ্ন থাকলে নির্দ্বিধায় জিজ্ঞেস করুন।",
                "You're welcome! Feel free to ask anything else.",
              ),
      };
    case "goodbye":
      return {
        text: pick(
          lang,
          "আল্লাহ হাফেজ! ফি আমানিল্লাহ, আল্লাহর হেফাজতে থাকুন। যেকোনো প্রশ্ন নিয়ে আবার চলে আসবেন।",
          "Allah Hafez! Fi amanillah, may Allah keep you safe. Come back with any question, anytime.",
        ),
      };
    default:
      return { text: "" };
  }
}

function zoneLabel(timeZone: string, lang: Lang): string {
  if (timeZone === DATE_TIME_CONFIG.timeZone) return pick(lang, "বাংলাদেশ", "Bangladesh");
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

function dateSection(clause: DetectedClause, context: Context): Section {
  const { lang, now, timeZone } = context;
  const today = todayIn(timeZone, now);
  const weekday = WEEKDAYS[lang][weekdayOf(today)] ?? "";
  const gregorian = gregorianLabel(today, lang);
  const bengali = bengaliLabel(bengaliCalendarDate(today), lang);
  const hijriDate = hijriCalendarDate(today);
  const hijri = hijriDate ? hijriLabel(hijriDate, lang) : null;
  const wantsHijri = clause.flags.includes("hijri");
  const wantsBangla = clause.flags.includes("bangla");
  const elsewhere = timeZone !== DATE_TIME_CONFIG.timeZone;
  const zoneNote = elsewhere
    ? pick(lang, ` (সময় অঞ্চল: ${timeZone})`, ` (time zone: ${timeZone})`)
    : "";
  const hijriNote = pick(
    lang,
    "হিজরি তারিখ উম্মুল কুরা হিসাব অনুযায়ী; চাঁদ দেখার ওপর নির্ভর করে বাংলাদেশে এক দিন কম-বেশি হতে পারে।",
    "The Hijri date follows the Umm al-Qura calendar; depending on the moon sighting it may differ by a day locally.",
  );

  const rows: GeneralCardRow[] = [
    {
      label: pick(lang, "ইংরেজি", "Gregorian"),
      value: gregorian,
      highlight: !wantsHijri && !wantsBangla,
    },
    { label: pick(lang, "বাংলা", "Bengali"), value: bengali, highlight: wantsBangla },
    ...(hijri
      ? [{ label: pick(lang, "হিজরি", "Hijri"), value: hijri, highlight: wantsHijri }]
      : []),
  ];

  const lead =
    clause.intent === "day"
      ? pick(
          lang,
          `আজ **${weekday}** (${gregorian})${zoneNote}।`,
          `Today is **${weekday}** (${gregorian})${zoneNote}.`,
        )
      : wantsHijri && hijri
        ? pick(
            lang,
            `আজ হিজরি **${hijri}**, ${weekday}${zoneNote}।`,
            `Today is **${hijri}**, ${weekday}${zoneNote}.`,
          )
        : wantsBangla
          ? pick(
              lang,
              `আজ **${bengali}**, ${weekday}${zoneNote}।`,
              `Today is **${bengali}**, ${weekday}${zoneNote}.`,
            )
          : pick(
              lang,
              `আজ **${weekday}**, ${gregorian} খ্রিস্টাব্দ${zoneNote}।`,
              `Today is **${weekday}**, ${gregorian}${zoneNote}.`,
            );

  const list = rows.map((row) => `- **${row.label}:** ${row.value}`).join("\n");
  return {
    text: `${lead}\n\n${list}${hijri ? `\n\n*${hijriNote}*` : ""}`,
    card: {
      kind: "date",
      lang,
      icon: "📅",
      eyebrow: elsewhere
        ? pick(lang, `আজ · ${timeZone}`, `Today · ${timeZone}`)
        : pick(lang, "আজ", "Today"),
      headline: weekday,
      subline: wantsHijri && hijri ? hijri : wantsBangla ? bengali : gregorian,
      rows,
      ...(hijri ? { note: hijriNote } : {}),
    },
  };
}

async function timeSection(clause: DetectedClause, context: Context): Promise<Section | null> {
  const { lang, now } = context;
  let timeZone = context.timeZone;
  let label = zoneLabel(timeZone, lang);

  if (clause.placeWords.length > 0) {
    const place = clause.explicitLocation
      ? await resolvePlace(clause.placeWords)
      : findKnownPlace(clause.placeWords);
    if (!place) return null;
    timeZone = place.timeZone;
    label = placeName(place, lang);
  }

  const today = todayIn(timeZone, now);
  const weekday = WEEKDAYS[lang][weekdayOf(today)] ?? "";
  const gregorian = gregorianLabel(today, lang);
  const clock24 = localDigits(
    `${String(today.hour).padStart(2, "0")}:${String(today.minute).padStart(2, "0")}`,
    lang,
  );
  const spoken =
    lang === "bn"
      ? spokenClock(today.hour, today.minute)
      : clockLabel(today.hour, today.minute, "en");
  const offset = offsetLabel(timeZone, now);

  return {
    text: pick(
      lang,
      `এখন ${label} সময় **${spoken}** (${clock24})।\n\nআজ ${weekday}, ${gregorian}। সময় অঞ্চল: ${timeZone} (${offset})।`,
      `It is **${spoken}** in ${label} right now (${clock24}).\n\nToday is ${weekday}, ${gregorian}. Time zone: ${timeZone} (${offset}).`,
    ),
    card: {
      kind: "time",
      lang,
      icon: "🕐",
      eyebrow: pick(lang, `${label} সময়`, `Time in ${label}`),
      headline: clockLabel(today.hour, today.minute, lang),
      subline: `${weekday}, ${gregorian}`,
      stats: [{ label: pick(lang, "সময় অঞ্চল", "Time zone"), value: `${timeZone} (${offset})` }],
      timeZone,
    },
  };
}

const WEATHER_CODES: {
  codes: number[];
  icon: string;
  nightIcon?: string;
  bn: string;
  en: string;
}[] = [
  { codes: [0], icon: "☀️", nightIcon: "🌙", bn: "পরিষ্কার আকাশ", en: "Clear sky" },
  { codes: [1], icon: "🌤️", nightIcon: "🌙", bn: "প্রায় পরিষ্কার আকাশ", en: "Mainly clear" },
  { codes: [2], icon: "⛅", nightIcon: "☁️", bn: "আংশিক মেঘলা", en: "Partly cloudy" },
  { codes: [3], icon: "☁️", bn: "মেঘাচ্ছন্ন আকাশ", en: "Overcast" },
  { codes: [45, 48], icon: "🌫️", bn: "কুয়াশা", en: "Fog" },
  { codes: [51, 53, 55, 56, 57], icon: "🌦️", bn: "গুঁড়ি গুঁড়ি বৃষ্টি", en: "Drizzle" },
  { codes: [61], icon: "🌧️", bn: "হালকা বৃষ্টি", en: "Light rain" },
  { codes: [63, 66], icon: "🌧️", bn: "মাঝারি বৃষ্টি", en: "Moderate rain" },
  { codes: [65, 67], icon: "🌧️", bn: "ভারী বৃষ্টি", en: "Heavy rain" },
  { codes: [71, 73, 75, 77, 85, 86], icon: "❄️", bn: "তুষারপাত", en: "Snow" },
  { codes: [80, 81, 82], icon: "🌦️", bn: "থেমে থেমে বৃষ্টি", en: "Rain showers" },
  { codes: [95], icon: "⛈️", bn: "বজ্রসহ বৃষ্টি", en: "Thunderstorm" },
  { codes: [96, 99], icon: "⛈️", bn: "শিলাবৃষ্টিসহ বজ্রঝড়", en: "Thunderstorm with hail" },
];

export function describeWeather(code: number, lang: Lang, isDay = true) {
  const entry = WEATHER_CODES.find((candidate) => candidate.codes.includes(code));
  if (!entry) return { icon: "🌡️", text: pick(lang, "আবহাওয়া", "Weather") };
  return {
    icon: !isDay && entry.nightIcon ? entry.nightIcon : entry.icon,
    text: pick(lang, entry.bn, entry.en),
  };
}

function degrees(value: number, lang: Lang): string {
  return lang === "bn" ? `${localDigits(Math.round(value), "bn")}°সে` : `${Math.round(value)}°C`;
}

function isoClock(value: string | null, lang: Lang): string | null {
  const clock = value ? parseClock(value.split("T")[1] ?? "") : null;
  return clock ? clockLabel(clock.hour, clock.minute, lang) : null;
}

async function weatherSection(clause: DetectedClause, context: Context): Promise<Section | null> {
  const { lang } = context;
  const place = await placeFor(clause, context);
  if (!place) return null;
  const report = await fetchWeather(place);
  if (!report) return unavailable(lang, { bn: "আবহাওয়ার তথ্য", en: "weather" }, place);

  const name = placeName(place, lang);
  const tomorrow = clause.flags.includes("tomorrow");
  const day: WeatherDay | undefined = report.days[tomorrow ? 1 : 0];
  const pct = (value: number) => `${localDigits(Math.round(value), lang)}%`;
  const rain = day?.rainChance ?? null;
  const sunrise = isoClock(day?.sunrise ?? null, lang);
  const sunset = isoClock(day?.sunset ?? null, lang);
  const updated = isoClock(report.observedAt, lang);
  const note = pick(
    lang,
    `তথ্যসূত্র: Open-Meteo${updated ? `, হালনাগাদ ${updated}` : ""}`,
    `Source: Open-Meteo${updated ? `, updated ${updated}` : ""}`,
  );

  if (tomorrow && day) {
    const look = describeWeather(day.code, lang);
    const lines = [
      pick(
        lang,
        `সর্বোচ্চ ${degrees(day.max, lang)}, সর্বনিম্ন ${degrees(day.min, lang)}`,
        `High ${degrees(day.max, lang)}, low ${degrees(day.min, lang)}`,
      ),
      ...(rain !== null
        ? [pick(lang, `বৃষ্টির সম্ভাবনা ${pct(rain)}`, `Chance of rain ${pct(rain)}`)]
        : []),
      ...(sunrise && sunset
        ? [
            pick(
              lang,
              `সূর্যোদয় ${sunrise}, সূর্যাস্ত ${sunset}`,
              `Sunrise ${sunrise}, sunset ${sunset}`,
            ),
          ]
        : []),
    ];
    return {
      text: `${pick(lang, `**${name}**, আগামীকালের পূর্বাভাস: ${look.icon} ${look.text}।`, `**${name}**, tomorrow's forecast: ${look.icon} ${look.text}.`)}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n\n*${note}*`,
      card: {
        kind: "weather",
        lang,
        icon: look.icon,
        eyebrow: pick(lang, `${name} · আগামীকাল`, `${name} · Tomorrow`),
        headline: `${degrees(day.max, lang)} / ${degrees(day.min, lang)}`,
        subline: look.text,
        stats: [
          ...(rain !== null
            ? [{ label: pick(lang, "বৃষ্টির সম্ভাবনা", "Rain chance"), value: pct(rain) }]
            : []),
          ...(sunrise ? [{ label: pick(lang, "সূর্যোদয়", "Sunrise"), value: sunrise }] : []),
          ...(sunset ? [{ label: pick(lang, "সূর্যাস্ত", "Sunset"), value: sunset }] : []),
        ],
        note,
      },
    };
  }

  const look = describeWeather(report.code, lang, report.isDay);
  const rainLead =
    clause.flags.includes("rain") && rain !== null
      ? pick(
          lang,
          `আজ ${name}-এ বৃষ্টির সম্ভাবনা **${pct(rain)}**${rain >= 50 ? ", ছাতা সাথে রাখা ভালো" : ""}।\n\n`,
          `The chance of rain in ${name} today is **${pct(rain)}**${rain >= 50 ? ", so an umbrella is a good idea" : ""}.\n\n`,
        )
      : "";
  const lines = [
    ...(day
      ? [
          pick(
            lang,
            `আজ সর্বোচ্চ ${degrees(day.max, lang)}, সর্বনিম্ন ${degrees(day.min, lang)}`,
            `Today's high ${degrees(day.max, lang)}, low ${degrees(day.min, lang)}`,
          ),
        ]
      : []),
    ...(rain !== null
      ? [pick(lang, `বৃষ্টির সম্ভাবনা ${pct(rain)}`, `Chance of rain ${pct(rain)}`)]
      : []),
    pick(
      lang,
      `আর্দ্রতা ${pct(report.humidity)}, বাতাস ঘণ্টায় ${localDigits(Math.round(report.windKmh), "bn")} কিমি`,
      `Humidity ${pct(report.humidity)}, wind ${Math.round(report.windKmh)} km/h`,
    ),
    ...(sunrise && sunset
      ? [
          pick(
            lang,
            `সূর্যোদয় ${sunrise}, সূর্যাস্ত ${sunset}`,
            `Sunrise ${sunrise}, sunset ${sunset}`,
          ),
        ]
      : []),
  ];

  return {
    text: `${rainLead}${pick(
      lang,
      `**${name}**, এখনকার আবহাওয়া: ${look.icon} ${look.text}, **${degrees(report.temperature, lang)}** (অনুভূত ${degrees(report.feelsLike, lang)})।`,
      `**${name}** right now: ${look.icon} ${look.text}, **${degrees(report.temperature, lang)}** (feels like ${degrees(report.feelsLike, lang)}).`,
    )}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n\n*${note}*`,
    card: {
      kind: "weather",
      lang,
      icon: look.icon,
      eyebrow: pick(lang, `${name} · এখন`, `${name} · Now`),
      headline: degrees(report.temperature, lang),
      subline: pick(
        lang,
        `${look.text} · অনুভূত ${degrees(report.feelsLike, lang)}`,
        `${look.text} · Feels like ${degrees(report.feelsLike, lang)}`,
      ),
      stats: [
        ...(day
          ? [
              {
                label: pick(lang, "সর্বোচ্চ / সর্বনিম্ন", "High / Low"),
                value: `${degrees(day.max, lang)} / ${degrees(day.min, lang)}`,
              },
            ]
          : []),
        ...(rain !== null
          ? [{ label: pick(lang, "বৃষ্টির সম্ভাবনা", "Rain chance"), value: pct(rain) }]
          : []),
        { label: pick(lang, "আর্দ্রতা", "Humidity"), value: pct(report.humidity) },
        {
          label: pick(lang, "বাতাস", "Wind"),
          value: pick(
            lang,
            `${localDigits(Math.round(report.windKmh), "bn")} কিমি/ঘণ্টা`,
            `${Math.round(report.windKmh)} km/h`,
          ),
        },
        ...(sunrise ? [{ label: pick(lang, "সূর্যোদয়", "Sunrise"), value: sunrise }] : []),
        ...(sunset ? [{ label: pick(lang, "সূর্যাস্ত", "Sunset"), value: sunset }] : []),
      ],
      note,
    },
  };
}

const PRAYER_NAMES: Record<PrayerKey, { bn: string; en: string; key: keyof PrayerTimings }> = {
  fajr: { bn: "ফজরের ওয়াক্ত শুরু", en: "Fajr begins at", key: "fajr" },
  dhuhr: { bn: "যোহরের ওয়াক্ত শুরু", en: "Dhuhr begins at", key: "dhuhr" },
  asr: { bn: "আসরের ওয়াক্ত শুরু (হানাফি)", en: "Asr (Hanafi) begins at", key: "asr" },
  maghrib: { bn: "মাগরিবের ওয়াক্ত শুরু", en: "Maghrib begins at", key: "maghrib" },
  isha: { bn: "এশার ওয়াক্ত শুরু", en: "Isha begins at", key: "isha" },
  sehri: { bn: "সেহরির শেষ সময় (সুবহে সাদিক)", en: "Sehri ends (true dawn) at", key: "fajr" },
  iftar: { bn: "ইফতারের সময় (মাগরিব)", en: "Iftar (Maghrib) is at", key: "maghrib" },
};

async function prayerSection(clause: DetectedClause, context: Context): Promise<Section | null> {
  const { lang, now } = context;
  const place = await placeFor(clause, context);
  if (!place) return null;

  const local = todayIn(place.timeZone, now);
  const nowMinutes = local.hour * 60 + local.minute;
  let date: CalendarDate = local;
  let timings = await fetchPrayerTimes(place, date);
  if (!timings) return unavailable(lang, { bn: "নামাজের সময়সূচি", en: "prayer times" }, place);

  const focus = clause.prayer ? PRAYER_NAMES[clause.prayer] : null;
  let nextDay = false;
  if (
    focus &&
    (clause.prayer === "sehri" || clause.prayer === "iftar") &&
    minutesOf(timings[focus.key]) < nowMinutes
  ) {
    const tomorrow = await fetchPrayerTimes(place, addDays(local, 1));
    if (tomorrow) {
      timings = tomorrow;
      date = addDays(local, 1);
      nextDay = true;
    }
  }

  const name = placeName(place, lang);
  const dateText = gregorianLabel(date, lang);
  const nextKey = nextDay
    ? null
    : (PRAYER_ROWS.find((row) => row.key !== "sunrise" && minutesOf(timings[row.key]) > nowMinutes)
        ?.key ?? null);
  const rows: GeneralCardRow[] = PRAYER_ROWS.map((row) => ({
    label: pick(lang, row.bn, row.en),
    value: prayerClock(timings[row.key], lang, row.period),
    highlight: focus ? focus.key === row.key : row.key === nextKey,
  }));
  const nextRow = PRAYER_ROWS.find((row) => row.key === nextKey);
  let upcoming = nextRow
    ? { bn: nextRow.bn, en: nextRow.en, value: timings[nextRow.key], period: nextRow.period }
    : null;
  if (!focus && !nextDay && !upcoming) {
    const tomorrow = await fetchPrayerTimes(place, addDays(local, 1));
    upcoming = {
      bn: "আগামীকাল ফজর",
      en: "Fajr tomorrow",
      value: (tomorrow ?? timings).fajr,
      period: undefined,
    };
  }
  const dayWord = nextDay ? pick(lang, "আগামীকাল", "Tomorrow") : pick(lang, "আজ", "Today");
  const note = pick(
    lang,
    "হিসাব: করাচি (ইউনিভার্সিটি অব ইসলামিক সায়েন্সেস) পদ্ধতি, আসর হানাফি মতে। স্থানীয় মসজিদ বা ইসলামিক ফাউন্ডেশনের সময়সূচির সাথে কয়েক মিনিট পার্থক্য হতে পারে।",
    "Calculated with the Karachi (University of Islamic Sciences) method, Asr by the Hanafi view. Your local mosque's timetable may differ by a few minutes.",
  );

  const lead = focus
    ? pick(
        lang,
        `${name}, ${dayWord} ${focus.bn} **${prayerClock(timings[focus.key], "bn", focus.key === "maghrib" ? "সন্ধ্যা" : focus.key === "isha" ? "রাত" : undefined)}**।`,
        `${dayWord} in ${name}, ${focus.en} **${prayerClock(timings[focus.key], "en")}**.`,
      )
    : pick(
        lang,
        `**${name}**, ${dayWord}কের (${dateText}) নামাজের সময়সূচি:`,
        `**${name}**, prayer times for ${dayWord.toLowerCase()} (${dateText}):`,
      );
  const table = [
    pick(lang, "| ওয়াক্ত | শুরু |", "| Prayer | Begins |"),
    "| --- | --- |",
    ...rows.map((row) => `| ${row.highlight ? `**${row.label}**` : row.label} | ${row.value} |`),
  ].join("\n");
  const nextLine =
    !focus && upcoming
      ? pick(
          lang,
          `\n\nপরবর্তী ওয়াক্ত: **${upcoming.bn}**, ${prayerClock(upcoming.value, "bn", upcoming.period)}।`,
          `\n\nNext prayer: **${upcoming.en}** at ${prayerClock(upcoming.value, "en")}.`,
        )
      : "";

  return {
    text: `${lead}\n\n${table}${nextLine}\n\n*${note}*`,
    card: {
      kind: "prayer",
      lang,
      icon: "🕌",
      eyebrow: pick(lang, `${name} · ${dayWord}, ${dateText}`, `${name} · ${dayWord}, ${dateText}`),
      headline: focus
        ? prayerClock(timings[focus.key], lang, focus.key === "maghrib" ? "সন্ধ্যা" : undefined)
        : upcoming
          ? prayerClock(upcoming.value, lang, upcoming.period)
          : pick(lang, "নামাজের সময়সূচি", "Prayer times"),
      subline: focus
        ? pick(lang, focus.bn, focus.en.replace(/ (?:at|is at|begins at)$/, ""))
        : upcoming
          ? pick(lang, `পরবর্তী ওয়াক্ত: ${upcoming.bn}`, `Next prayer: ${upcoming.en}`)
          : pick(lang, "নামাজের সময়সূচি", "Prayer times"),
      rows,
      note,
    },
  };
}

async function sectionFor(clause: DetectedClause, context: Context): Promise<Section | null> {
  switch (clause.intent) {
    case "date":
    case "day":
      return dateSection(clause, context);
    case "time":
      return timeSection(clause, context);
    case "weather":
      return weatherSection(clause, context);
    case "prayer":
      return prayerSection(clause, context);
    case "currentPrayer":
      return currentPrayerSection(clause, context);
    case "kalima":
      return kalimaSection(clause, context.lang);
    case "salahImportance":
      return salahImportanceSection(context.lang);
    case "salahFazilat":
      return salahFazilatSection(context.lang);
    case "rakat":
      return rakatSection(clause, context.lang);
    case "ramadan":
      return ramadanSection(context);
    case "sawmNiyat":
      return sawmNiyatSection(context.lang);
    case "iftarDua":
      return iftarDuaSection(context.lang);
    case "sawmFazilat":
      return sawmFazilatSection(context.lang);
    case "hajj":
      return hajjSection(clause, context);
    case "hajjFazilat":
      return hajjFazilatSection(context.lang);
    case "zakatNisab":
      return zakatNisabSection(context);
    case "zakatRate":
      return zakatRateSection(context.lang);
    case "zakatCalc":
      return zakatCalcSection(clause, context);
    case "zakatFazilat":
      return zakatFazilatSection(context.lang);
    default:
      return socialSection(clause, context.lang);
  }
}

function invitation(lang: Lang): Section {
  return {
    text: pick(
      lang,
      "কুরআন, হাদিস ও ফিকহের দলিলসহ যেকোনো ইসলামি প্রশ্ন করতে পারেন। আজকের তারিখ, সময়, আবহাওয়া বা নামাজের সময়সূচিও জানতে চাইতে পারেন।",
      "Ask me any Islamic question and I'll answer with evidence from the Quran, Hadith and fiqh books. I can also tell you today's date, the time, the weather or prayer times.",
    ),
  };
}

export async function answerGeneralQuestion(
  question: string,
  {
    conversationBangla = false,
    timeZone = DEFAULT_PLACE.timeZone,
    now = new Date(),
  }: { conversationBangla?: boolean; timeZone?: string; now?: Date } = {},
): Promise<GeneralAnswer | null> {
  const detection = detectGeneral(question, conversationBangla);
  if (!detection) return null;

  const context: Context = { lang: detection.lang, now, timeZone };
  const resolved = await Promise.all(
    detection.clauses.map((clause) => sectionFor(clause, context)),
  );
  if (resolved.some((section) => section === null)) return null;
  const sections = resolved.filter((section): section is Section => section !== null);

  const intents = detection.clauses.map((clause) => clause.intent);
  if (intents.every((intent) => SOCIAL.includes(intent))) sections.push(invitation(detection.lang));

  const text = sections.map((section) => section.text).join("\n\n");
  const blocks: GeneralBlock[] = sections.flatMap(
    (section): GeneralBlock[] =>
      section.blocks ??
      (section.card
        ? [{ type: "card", card: section.card }]
        : [{ type: "markdown", text: section.text }]),
  );

  return {
    text,
    info: { intents: [...new Set(intents)], blocks },
    evidence: citedReferences(text),
  };
}
