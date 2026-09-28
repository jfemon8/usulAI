import {
  addDays,
  gregorianLabel,
  hijriCalendarDate,
  localDigits,
  nextHijriDate,
  weekdayOf,
  WEEKDAYS,
  type CalendarDate,
  type Lang,
} from "@/lib/general/calendar";
import type { DetectedClause } from "@/lib/general/intents";
import { fetchPrayerTimes, type PrayerTimings } from "@/lib/general/liveData";
import { fetchMetalPrices } from "@/lib/general/metals";
import { placeName } from "@/lib/general/places";
import {
  amount,
  cite,
  minutesOf,
  money,
  pick,
  placeFor,
  PRAYER_ROWS,
  prayerClock,
  todayIn,
  unavailable,
  type Context,
  type Section,
} from "@/lib/general/section";
import {
  computeZakat,
  emptyAssets,
  GOLD_NISAB_GRAMS,
  SILVER_NISAB_GRAMS,
  VORI_GRAMS,
} from "@/lib/general/zakatMath";
import type { GeneralCardRow, ZakatAssets, ZakatPrices } from "@/types";

const PRAYER_METHOD_NOTE = {
  bn: "হিসাব: করাচি (ইউনিভার্সিটি অব ইসলামিক সায়েন্সেস) পদ্ধতি, আসর হানাফি মতে। স্থানীয় মসজিদের সময়সূচির সাথে কয়েক মিনিট পার্থক্য হতে পারে।",
  en: "Calculated with the Karachi (University of Islamic Sciences) method, Asr by the Hanafi view. Your local mosque may differ by a few minutes.",
};

export function durationLabel(minutes: number, lang: Lang): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (lang === "bn") {
    const parts = [
      hours > 0 ? `${localDigits(hours, "bn")} ঘণ্টা` : "",
      rest > 0 || hours === 0 ? `${localDigits(rest, "bn")} মিনিট` : "",
    ];
    return parts.filter(Boolean).join(" ");
  }
  const parts = [hours > 0 ? `${hours} h` : "", rest > 0 || hours === 0 ? `${rest} min` : ""];
  return parts.filter(Boolean).join(" ");
}

interface Waqt {
  key: keyof PrayerTimings | null;
  endsAt: string;
  next: keyof PrayerTimings;
  nextTomorrow: boolean;
}

export function currentWaqt(timings: PrayerTimings, nowMinutes: number): Waqt {
  const at = (key: keyof PrayerTimings) => minutesOf(timings[key]);
  if (nowMinutes < at("fajr")) {
    return { key: "isha", endsAt: timings.fajr, next: "fajr", nextTomorrow: false };
  }
  if (nowMinutes < at("sunrise")) {
    return { key: "fajr", endsAt: timings.sunrise, next: "dhuhr", nextTomorrow: false };
  }
  if (nowMinutes < at("dhuhr")) {
    return { key: null, endsAt: timings.dhuhr, next: "dhuhr", nextTomorrow: false };
  }
  if (nowMinutes < at("asr")) {
    return { key: "dhuhr", endsAt: timings.asr, next: "asr", nextTomorrow: false };
  }
  if (nowMinutes < at("maghrib")) {
    return { key: "asr", endsAt: timings.maghrib, next: "maghrib", nextTomorrow: false };
  }
  if (nowMinutes < at("isha")) {
    return { key: "maghrib", endsAt: timings.isha, next: "isha", nextTomorrow: false };
  }
  return { key: "isha", endsAt: timings.fajr, next: "fajr", nextTomorrow: true };
}

const WAQT_NOTES: Partial<Record<keyof PrayerTimings | "none", { bn: string; en: string }>> = {
  none: {
    bn: "এখন কোনো ফরজ নামাজের ওয়াক্ত নেই। সূর্যোদয়ের পর প্রায় ১৫ থেকে ২০ মিনিট এবং ঠিক দুপুরে (যোহরের কিছুক্ষণ আগে) নামাজ পড়া নিষেধ; এর মাঝের সময়ে ইশরাক ও চাশতের নফল নামাজ পড়া যায়।",
    en: "No obligatory prayer is due right now. Praying is prohibited for about 15 to 20 minutes after sunrise and at the zenith just before Dhuhr; in between, the voluntary Ishraq and Duha prayers can be offered.",
  },
  asr: {
    bn: "সূর্য হলদে হয়ে যাওয়ার পর (সূর্যাস্তের আগের শেষ কয়েক মিনিট) আসর পড়া মাকরুহ, তাই দেরি না করাই উত্তম।",
    en: "Delaying Asr until the sun turns yellow, in the last minutes before sunset, is disliked, so it is best not to wait.",
  },
  isha: {
    bn: "এশার ওয়াক্ত সুবহে সাদিক পর্যন্ত থাকে, তবে মধ্যরাতের আগে পড়ে নেওয়া উত্তম। বিতর এশার পরেই পড়া যায়।",
    en: "Isha lasts until true dawn, but it is best prayed before midnight. Witr can be prayed any time after Isha.",
  },
};

function rowFor(key: keyof PrayerTimings) {
  return PRAYER_ROWS.find((row) => row.key === key) ?? PRAYER_ROWS[0]!;
}

export async function currentPrayerSection(
  clause: DetectedClause,
  context: Context,
): Promise<Section | null> {
  const { lang, now } = context;
  const place = await placeFor(clause, context);
  if (!place) return null;
  const local = todayIn(place.timeZone, now);
  const timings = await fetchPrayerTimes(place, local);
  if (!timings) return unavailable(lang, { bn: "নামাজের সময়সূচি", en: "prayer times" }, place);

  const nowMinutes = local.hour * 60 + local.minute;
  const waqt = currentWaqt(timings, nowMinutes);
  const nextTimings = waqt.nextTomorrow
    ? ((await fetchPrayerTimes(place, addDays(local, 1))) ?? timings)
    : timings;
  const nextRow = rowFor(waqt.next);
  const nextValue = nextTimings[waqt.next];
  const remaining = minutesOf(nextValue) - nowMinutes + (waqt.nextTomorrow ? 1440 : 0);
  const name = placeName(place, lang);
  const current = waqt.key ? rowFor(waqt.key) : null;
  const endsAt = prayerClock(
    waqt.endsAt,
    lang,
    waqt.key === "asr" ? "সন্ধ্যা" : waqt.key === "maghrib" ? "রাত" : undefined,
  );
  const nextClock = prayerClock(nextValue, lang, nextRow.period);
  const wait = durationLabel(Math.max(0, remaining), lang);
  const note = WAQT_NOTES[waqt.key ?? "none"];

  const lead = current
    ? pick(
        lang,
        `**${name}**, এখন **${current.of ?? current.bn}** ওয়াক্ত চলছে (শুরু ${prayerClock(timings[current.key], "bn", current.period)}, শেষ ${{ fajr: "সূর্যোদয়ে ", asr: "সূর্যাস্তে ", isha: "সুবহে সাদিকে " }[waqt.key as string] ?? ""}${endsAt})।`,
        `**${name}**: it is now the time of **${current.en}** (began ${prayerClock(timings[current.key], "en")}, ends ${endsAt}).`,
      )
    : pick(
        lang,
        `**${name}**, এখন কোনো ফরজ নামাজের ওয়াক্ত নেই।`,
        `**${name}**: no obligatory prayer is due right now.`,
      );
  const nextLine = pick(
    lang,
    `পরবর্তী ওয়াক্ত **${nextRow.bn}**, ${waqt.nextTomorrow ? "আগামীকাল " : ""}${nextClock}, অর্থাৎ **${wait}** পর।`,
    `Next is **${nextRow.en}** ${waqt.nextTomorrow ? "tomorrow " : ""}at ${nextClock}, in **${wait}**.`,
  );

  const rows: GeneralCardRow[] = PRAYER_ROWS.map((row) => ({
    label: pick(lang, row.bn, row.en),
    value: prayerClock(timings[row.key], lang, row.period),
    highlight: row.key === waqt.key,
  }));
  const seconds = now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
  const markdownNote = note ? pick(lang, note.bn, note.en) : "";

  return {
    text: [
      lead,
      nextLine,
      markdownNote,
      `*${pick(lang, PRAYER_METHOD_NOTE.bn, PRAYER_METHOD_NOTE.en)}*`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    blocks: [
      {
        type: "card",
        card: {
          kind: "prayerNow",
          lang,
          icon: "🕌",
          eyebrow: pick(lang, `${name} · এখন`, `${name} · Now`),
          headline: current
            ? pick(lang, `${current.of ?? current.bn} ওয়াক্ত`, `${current.en} time`)
            : pick(lang, "কোনো ফরজ ওয়াক্ত নেই", "No obligatory prayer due"),
          subline: current
            ? pick(lang, `শেষ হবে ${endsAt}`, `Ends at ${endsAt}`)
            : pick(lang, `যোহর শুরু ${nextClock}`, `Dhuhr begins at ${nextClock}`),
          stats: [
            {
              label: pick(lang, "পরবর্তী ওয়াক্ত", "Next prayer"),
              value: `${pick(lang, nextRow.bn, nextRow.en)} · ${nextClock}`,
            },
          ],
          countdown: {
            to: now.getTime() - seconds + Math.max(0, remaining) * 60_000,
            label: pick(lang, `${nextRow.bn} শুরু হতে বাকি`, `Until ${nextRow.en}`),
          },
          rows,
          note: pick(lang, PRAYER_METHOD_NOTE.bn, PRAYER_METHOD_NOTE.en),
        },
      },
      ...(markdownNote ? [{ type: "markdown" as const, text: markdownNote }] : []),
    ],
  };
}

function dateWithWeekday(date: CalendarDate, lang: Lang): string {
  return `${gregorianLabel(date, lang)}, ${WEEKDAYS[lang][weekdayOf(date)] ?? ""}`;
}

const MOON_NOTE = {
  bn: "তারিখটি সৌদি আরবের উম্মুল কুরা ক্যালেন্ডার অনুযায়ী হিসাব করা; বাংলাদেশে চাঁদ দেখার ওপর নির্ভর করে এক দিন পরে শুরু হতে পারে। চূড়ান্ত তারিখ জাতীয় চাঁদ দেখা কমিটির ঘোষণা অনুযায়ী।",
  en: "Calculated with Saudi Arabia's Umm al-Qura calendar; locally it may begin a day later depending on the moon sighting, so follow your national moon-sighting announcement.",
};

export function ramadanSection(context: Context): Section {
  const { lang, now, timeZone } = context;
  const today = todayIn(timeZone, now);
  const hijri = hijriCalendarDate(today);
  const note = `*${pick(lang, MOON_NOTE.bn, MOON_NOTE.en)}*`;

  if (hijri?.month === 9) {
    const eid = nextHijriDate(today, 10, 1);
    const eidLine = eid
      ? pick(
          lang,
          `ঈদুল ফিতর আর প্রায় **${localDigits(eid.daysAway, "bn")} দিন** পর (সম্ভাব্য ${dateWithWeekday(eid.date, "bn")})।`,
          `Eid al-Fitr is about **${eid.daysAway} days** away (expected ${dateWithWeekday(eid.date, "en")}).`,
        )
      : "";
    const dayText = pick(lang, `${localDigits(hijri.day, "bn")} রমজান`, `${hijri.day} Ramadan`);
    return {
      text: `${pick(lang, `আজ **${dayText}** ${localDigits(hijri.year, "bn")} হিজরি।`, `Today is **${dayText}** ${hijri.year} AH.`)}\n\n${eidLine}\n\n${pick(
        lang,
        `রমজান সেই মাস, যাতে কুরআন নাযিল হয়েছে; যে এই মাস পাবে, সে যেন রোজা রাখে${cite("Al-Baqara 2:185")}।`,
        `Ramadan is the month in which the Quran was revealed; whoever witnesses it should fast${cite("Al-Baqara 2:185")}.`,
      )}\n\n${note}`,
      blocks: [
        {
          type: "card",
          card: {
            kind: "ramadan",
            lang,
            icon: "🌙",
            eyebrow: pick(lang, `রমজান ${localDigits(hijri.year, "bn")}`, `Ramadan ${hijri.year}`),
            headline: dayText,
            subline: dateWithWeekday(today, lang),
            stats: eid
              ? [
                  {
                    label: pick(lang, "ঈদুল ফিতর", "Eid al-Fitr"),
                    value: pick(
                      lang,
                      `${localDigits(eid.daysAway, "bn")} দিন পর`,
                      `in ${eid.daysAway} days`,
                    ),
                  },
                ]
              : [],
            note: pick(lang, MOON_NOTE.bn, MOON_NOTE.en),
          },
        },
        {
          type: "markdown",
          text: pick(
            lang,
            `রমজান সেই মাস, যাতে কুরআন নাযিল হয়েছে; যে এই মাস পাবে, সে যেন রোজা রাখে${cite("Al-Baqara 2:185")}।`,
            `Ramadan is the month in which the Quran was revealed; whoever witnesses it should fast${cite("Al-Baqara 2:185")}.`,
          ),
        },
      ],
    };
  }

  if (hijri?.month === 10 && hijri.day === 1) {
    const text = pick(
      lang,
      "আজ **ঈদুল ফিতর**, ঈদ মোবারক! আজ রোজা রাখা নিষেধ।",
      "Today is **Eid al-Fitr**, Eid Mubarak! Fasting is not allowed today.",
    );
    return { text: `${text}\n\n${note}` };
  }

  const start = nextHijriDate(today, 9, 1);
  if (!start) {
    return {
      text: pick(
        lang,
        "দুঃখিত, রমজানের তারিখ হিসাব করা যায়নি।",
        "Sorry, I couldn't work out the Ramadan dates.",
      ),
    };
  }
  const startYear = hijriCalendarDate(start.date)?.year ?? 0;
  const days = pick(lang, `${localDigits(start.daysAway, "bn")} দিন`, `${start.daysAway} days`);
  const lead = pick(
    lang,
    `রমজান শুরু হতে আর প্রায় **${days}** বাকি। সম্ভাব্য প্রথম রোজা **${dateWithWeekday(start.date, "bn")}** (১ রমজান ${localDigits(startYear, "bn")} হিজরি)।`,
    `Ramadan begins in about **${days}**. The first fast is expected on **${dateWithWeekday(start.date, "en")}** (1 Ramadan ${startYear} AH).`,
  );
  const evidence = pick(
    lang,
    `রমজানের রোজা ফরজ${cite("Al-Baqara 2:183", "Al-Baqara 2:185")}।`,
    `Fasting Ramadan is obligatory${cite("Al-Baqara 2:183", "Al-Baqara 2:185")}.`,
  );

  return {
    text: `${lead}\n\n${evidence}\n\n${note}`,
    blocks: [
      {
        type: "card",
        card: {
          kind: "ramadan",
          lang,
          icon: "🌙",
          eyebrow: pick(lang, `রমজান ${localDigits(startYear, "bn")}`, `Ramadan ${startYear}`),
          headline: pick(lang, `${days} বাকি`, `${days} to go`),
          subline: pick(
            lang,
            `সম্ভাব্য প্রথম রোজা: ${dateWithWeekday(start.date, "bn")}`,
            `First fast expected: ${dateWithWeekday(start.date, "en")}`,
          ),
          note: pick(lang, MOON_NOTE.bn, MOON_NOTE.en),
        },
      },
      { type: "markdown", text: evidence },
    ],
  };
}

const HAJJ_DAYS: Record<number, { bn: string; en: string }> = {
  8: {
    bn: "ইয়াওমুত তারবিয়া: হাজিরা ইহরাম অবস্থায় মিনায় গিয়ে অবস্থান করেন।",
    en: "Yawm al-Tarwiyah: pilgrims in ihram go to Mina and stay there.",
  },
  9: {
    bn: "ইয়াওমে আরাফা: হজের প্রধান রুকন আরাফার ময়দানে অবস্থান, সূর্যাস্তের পর মুযদালিফায় রাতযাপন।",
    en: "The Day of Arafah: standing at Arafah, the central pillar of Hajj, then spending the night at Muzdalifah after sunset.",
  },
  10: {
    bn: "ইয়াওমুন নাহর (ঈদুল আজহা): জামরাতুল আকাবায় কংকর নিক্ষেপ, কুরবানি, মাথা মুণ্ডন বা চুল ছোট করা এবং তাওয়াফে যিয়ারত।",
    en: "Yawm al-Nahr (Eid al-Adha): stoning Jamrat al-Aqabah, the sacrifice, shaving or trimming the hair and Tawaf al-Ifadah.",
  },
  11: {
    bn: "আইয়ামে তাশরিক: মিনায় অবস্থান করে তিন জামরায় কংকর নিক্ষেপ।",
    en: "Ayyam al-Tashriq: staying in Mina and stoning the three jamarat.",
  },
  12: {
    bn: "আইয়ামে তাশরিক: তিন জামরায় কংকর নিক্ষেপ; চাইলে সূর্যাস্তের আগে মিনা ত্যাগ করা যায়।",
    en: "Ayyam al-Tashriq: stoning the three jamarat; pilgrims may leave Mina before sunset.",
  },
  13: {
    bn: "আইয়ামে তাশরিকের শেষ দিন: যারা মিনায় থেকে গেছেন, তারা তিন জামরায় কংকর নিক্ষেপ করেন।",
    en: "The last day of Tashriq: those who stayed in Mina stone the three jamarat.",
  },
};

const BN_ORDINAL_DAYS = ["", "প্রথম", "দ্বিতীয়", "তৃতীয়", "চতুর্থ", "পঞ্চম", "ষষ্ঠ"];
const EN_ORDINAL_DAYS = ["", "first", "second", "third", "fourth", "fifth", "sixth"];

export function hajjSection(clause: DetectedClause, context: Context): Section {
  const { lang, now, timeZone } = context;
  const today = todayIn(timeZone, now);
  const hijri = hijriCalendarDate(today);
  const note = pick(lang, MOON_NOTE.bn, MOON_NOTE.en).replace(
    pick(lang, "শুরু হতে পারে", "begin"),
    pick(lang, "হতে পারে", "differ"),
  );

  if (hijri?.month === 12 && hijri.day >= 8 && hijri.day <= 13) {
    const number = hijri.day - 7;
    const rite = HAJJ_DAYS[hijri.day];
    const headline = pick(lang, `হজের ${BN_ORDINAL_DAYS[number]} দিন`, `Day ${number} of Hajj`);
    const text = pick(
      lang,
      `আজ **${localDigits(hijri.day, "bn")} জিলহজ ${localDigits(hijri.year, "bn")}**, হজের **${BN_ORDINAL_DAYS[number]} দিন**।\n\n${rite?.bn ?? ""}${hijri.day === 9 ? cite("সহীহ মুসলিম 3288") : ""}`,
      `Today is **${hijri.day} Dhul-Hijjah ${hijri.year}**, the **${EN_ORDINAL_DAYS[number]} day** of Hajj.\n\n${rite?.en ?? ""}${hijri.day === 9 ? cite("সহীহ মুসলিম 3288") : ""}`,
    );
    return {
      text: `${text}\n\n*${note}*`,
      blocks: [
        {
          type: "card",
          card: {
            kind: "hajj",
            lang,
            icon: "🕋",
            eyebrow: pick(
              lang,
              `${localDigits(hijri.day, "bn")} জিলহজ`,
              `${hijri.day} Dhul-Hijjah`,
            ),
            headline,
            subline: pick(lang, rite?.bn ?? "", rite?.en ?? ""),
            note,
          },
        },
        ...(hijri.day === 9 ? [{ type: "markdown" as const, text: cite("সহীহ মুসলিম 3288") }] : []),
      ],
    };
  }

  const start = nextHijriDate(today, 12, 8);
  if (!start) {
    return {
      text: pick(
        lang,
        "দুঃখিত, হজের তারিখ হিসাব করা যায়নি।",
        "Sorry, I couldn't work out the Hajj dates.",
      ),
    };
  }
  const arafah = addDays(start.date, 1);
  const eid = addDays(start.date, 2);
  const year = hijriCalendarDate(start.date)?.year ?? 0;
  const days = pick(lang, `${localDigits(start.daysAway, "bn")} দিন`, `${start.daysAway} days`);
  const notNow =
    hijri && clause.flags.includes("today")
      ? pick(lang, "আজ হজের দিন নয়। ", "Today is not one of the days of Hajj. ")
      : "";
  const lead = pick(
    lang,
    `${notNow}পরবর্তী হজ শুরু হবে প্রায় **${days}** পর, ৮ জিলহজ ${localDigits(year, "bn")} হিজরি (**${dateWithWeekday(start.date, "bn")}**) থেকে।`,
    `${notNow}The next Hajj begins in about **${days}**, on 8 Dhul-Hijjah ${year} AH (**${dateWithWeekday(start.date, "en")}**).`,
  );
  const rows: GeneralCardRow[] = [
    {
      label: pick(lang, "হজ শুরু (৮ জিলহজ)", "Hajj begins (8 Dhul-Hijjah)"),
      value: dateWithWeekday(start.date, lang),
    },
    {
      label: pick(lang, "আরাফার দিন (৯ জিলহজ)", "Day of Arafah (9 Dhul-Hijjah)"),
      value: dateWithWeekday(arafah, lang),
      highlight: true,
    },
    {
      label: pick(lang, "ঈদুল আজহা (১০ জিলহজ)", "Eid al-Adha (10 Dhul-Hijjah)"),
      value: dateWithWeekday(eid, lang),
    },
  ];
  const list = rows.map((row) => `- **${row.label}:** ${row.value}`).join("\n");

  return {
    text: `${lead}\n\n${list}\n\n*${note}*`,
    blocks: [
      {
        type: "card",
        card: {
          kind: "hajj",
          lang,
          icon: "🕋",
          eyebrow: pick(lang, `হজ ${localDigits(year, "bn")} হিজরি`, `Hajj ${year} AH`),
          headline: pick(lang, `${days} বাকি`, `${days} to go`),
          subline: pick(
            lang,
            `শুরু ${dateWithWeekday(start.date, "bn")}`,
            `Begins ${dateWithWeekday(start.date, "en")}`,
          ),
          rows,
          note,
        },
      },
    ],
  };
}

function priceNote(prices: ZakatPrices, lang: Lang): string {
  return (
    pick(
      lang,
      "দাম আন্তর্জাতিক বাজারদর ও আজকের ডলার রেট থেকে আনুমানিক হিসাব করা; আপনার এলাকার জুয়েলারি দোকানের (বাজুস) দামের সাথে পার্থক্য হতে পারে। সঠিক হিসাবের জন্য নিচের ক্যালকুলেটরে স্থানীয় দাম বসিয়ে নিন।",
      "Prices are estimated from international spot rates and today's exchange rate; local jewellers' prices can differ, so enter your local price in the calculator below for an exact figure.",
    ) +
    (prices.goldPerGram === null
      ? pick(lang, " (এই মুহূর্তে দাম আনা যায়নি।)", " (Prices could not be fetched right now.)")
      : "")
  );
}

export async function zakatNisabSection(context: Context): Promise<Section> {
  const { lang } = context;
  const prices = await fetchMetalPrices();
  const silverNisab =
    prices.silverPerGram === null ? null : SILVER_NISAB_GRAMS * prices.silverPerGram;
  const goldNisab =
    prices.goldPerGram === null ? null : GOLD_NISAB_GRAMS * prices.goldPerGram * (22 / 24);
  const live =
    silverNisab !== null && goldNisab !== null
      ? pick(
          lang,
          `\n\n**আজকের আনুমানিক নিসাব:**\n- রুপার হিসাবে: প্রায় **${money(silverNisab, "bn")}**\n- সোনার হিসাবে (২২ ক্যারেট): প্রায় **${money(goldNisab, "bn")}**`,
          `\n\n**Today's approximate nisab:**\n- By silver: about **${money(silverNisab, "en")}**\n- By gold (22 carat): about **${money(goldNisab, "en")}**`,
        )
      : "";

  return {
    text: pick(
      lang,
      `### যাকাতের নিসাব

- **সোনা:** সাড়ে ৭ ভরি (৮৭.৪৮ গ্রাম)
- **রুপা:** সাড়ে ৫২ ভরি (৬১২.৩৬ গ্রাম)
- **নগদ টাকা, ব্যবসার পণ্য বা মিশ্র সম্পদ:** মোট মূল্য সাড়ে ৫২ ভরি রুপার দামের সমান বা বেশি হলে। হানাফি আলেমরা এক্ষেত্রে রুপার নিসাব ধরেন, কারণ এতে গরিবদের উপকার বেশি।

পাঁচ উকিয়া (২০০ দিরহাম) রুপার কমে যাকাত নেই${cite("সহীহ বুখারী 1405")}, আর ২০০ দিরহাম ও ২০ দিনারে এক বছর পূর্ণ হলে চল্লিশ ভাগের এক ভাগ যাকাত${cite("সুনানে আবু দাউদ 1573")}। এই দিরহাম ও দিনারের ওজনই আজকের সাড়ে ৫২ ভরি রুপা ও সাড়ে ৭ ভরি সোনা।${live}

*${priceNote(prices, "bn")}*`,
      `### Nisab of zakat

- **Gold:** 7.5 tola (87.48 grams)
- **Silver:** 52.5 tola (612.36 grams)
- **Cash, business stock or mixed wealth:** when the total is worth at least 52.5 tola of silver. Hanafi scholars use the silver nisab here because it benefits the poor more.

There is no zakat on less than five awaq (200 dirhams) of silver${cite("সহীহ বুখারী 1405")}, and on 200 dirhams or 20 dinars held for a year one fortieth is due${cite("সুনানে আবু দাউদ 1573")}. Those weights are today's 52.5 tola of silver and 7.5 tola of gold.${live}

*${priceNote(prices, "en")}*`,
    ),
  };
}

function breakdown(assets: ZakatAssets, prices: ZakatPrices, lang: Lang): string {
  const result = computeZakat(assets, prices);
  const karat = localDigits(assets.goldKarat, lang);
  const grams = (value: number) => amount(value, lang, 1);
  const vori = (value: number) => amount(value / VORI_GRAMS, lang, 2);
  const lines: [string, number][] = [];
  if (assets.cash > 0)
    lines.push([pick(lang, "নগদ ও ব্যাংকে জমা", "Cash and savings"), assets.cash]);
  if (assets.business > 0)
    lines.push([pick(lang, "ব্যবসার পণ্য", "Business stock"), assets.business]);
  if (assets.receivables > 0)
    lines.push([pick(lang, "পাওনা টাকা", "Money owed to you"), assets.receivables]);
  if (result.goldValue > 0 || assets.goldGrams > 0) {
    lines.push([
      assets.goldGrams > 0
        ? pick(
            lang,
            `সোনা (${vori(assets.goldGrams)} ভরি, ${karat} ক্যারেট)`,
            `Gold (${grams(assets.goldGrams)} g, ${karat} carat)`,
          )
        : pick(lang, "সোনা", "Gold"),
      result.goldValue,
    ]);
  }
  if (result.silverValue > 0 || assets.silverGrams > 0) {
    lines.push([
      assets.silverGrams > 0
        ? pick(
            lang,
            `রুপা (${vori(assets.silverGrams)} ভরি)`,
            `Silver (${grams(assets.silverGrams)} g)`,
          )
        : pick(lang, "রুপা", "Silver"),
      result.silverValue,
    ]);
  }

  const table = [
    pick(lang, "| সম্পদ | মূল্য |", "| Asset | Value |"),
    "| --- | --- |",
    ...lines.map(([label, value]) => `| ${label} | ${money(value, lang)} |`),
    ...(assets.debts > 0
      ? [
          `| ${pick(lang, "ঋণ ও দেনা (বাদ)", "Debts due (deducted)")} | −${money(assets.debts, lang)} |`,
        ]
      : []),
    `| **${pick(lang, "যাকাতযোগ্য মোট সম্পদ", "Net zakatable wealth")}** | **${money(result.net, lang)}** |`,
  ].join("\n");

  const basis =
    result.basis === "gold"
      ? pick(lang, "সাড়ে ৭ ভরি সোনা", "7.5 tola of gold")
      : pick(lang, "সাড়ে ৫২ ভরি রুপা", "52.5 tola of silver");
  const nisabLine =
    result.nisabValue === null
      ? pick(
          lang,
          `নিসাব: ${basis} (দাম না পাওয়ায় টাকায় তুলনা করা যায়নি)।`,
          `Nisab: ${basis} (no price available to compare in taka).`,
        )
      : pick(
          lang,
          `নিসাব (${basis}): প্রায় ${money(result.nisabValue, "bn")}। আপনার সম্পদ নিসাব ${result.meetsNisab ? "**ছাড়িয়েছে**" : "**ছাড়ায়নি**"}।`,
          `Nisab (${basis}): about ${money(result.nisabValue, "en")}. Your wealth ${result.meetsNisab ? "**meets**" : "**does not meet**"} the nisab.`,
        );
  const dueLine = result.meetsNisab
    ? pick(
        lang,
        `**প্রদেয় যাকাত (২.৫%): ${money(result.due, "bn")}**`,
        `**Zakat due (2.5%): ${money(result.due, "en")}**`,
      )
    : result.meetsNisab === false
      ? pick(lang, "এই হিসাবে আপনার ওপর যাকাত ফরজ হয়নি।", "On these figures, zakat is not due.")
      : "";

  return [table, nisabLine, dueLine].filter(Boolean).join("\n\n");
}

export async function zakatCalcSection(clause: DetectedClause, context: Context): Promise<Section> {
  const { lang } = context;
  const prices = await fetchMetalPrices();
  const assets = clause.assets ?? emptyAssets();
  const found = clause.assets !== undefined;
  const intro = found
    ? pick(lang, "### আপনার যাকাতের হিসাব", "### Your zakat")
    : pick(
        lang,
        "### যাকাত ক্যালকুলেটর\n\nনিচে আপনার সম্পদের পরিমাণ লিখুন, যাকাত সাথে সাথে হিসাব হয়ে যাবে। চাইলে সরাসরি লিখেও জানাতে পারেন, যেমন: “আমার ৫ লাখ টাকা, ১০ ভরি সোনা আর ১ লাখ টাকা ঋণ আছে, যাকাত কত?”",
        '### Zakat calculator\n\nEnter what you own below and the zakat is worked out instantly. You can also just tell me, for example: "I have 5 lakh taka, 10 tola of gold and 1 lakh in debts, how much zakat?"',
      );
  const result = found ? breakdown(assets, prices, lang) : "";
  const rules = pick(
    lang,
    `*হিসাবের নিয়ম: নিসাব পরিমাণ সম্পদের ওপর এক চান্দ্র বছর পূর্ণ হলে যাকাতযোগ্য মোট সম্পদের ২.৫% দিতে হয়${cite("সুনানে আবু দাউদ 1573")}। শুধু সোনা থাকলে সোনার নিসাব, অন্য কিছুর সাথে মিশ্র হলে রুপার নিসাব (হানাফি মত) ধরা হয়েছে। এখনই পরিশোধযোগ্য ঋণ বাদ দেওয়া হয়। ${priceNote(prices, "bn")} নিজের নির্দিষ্ট অবস্থার জন্য একজন আলেমের পরামর্শ নিন।*`,
    `*How it works: once wealth at the nisab has been held for a lunar year, 2.5% of the net zakatable total is due${cite("সুনানে আবু দাউদ 1573")}. Gold alone uses the gold nisab; mixed wealth uses the silver nisab (Hanafi view). Debts due now are deducted. ${priceNote(prices, "en")} Please consult a scholar for your particular situation.*`,
  );

  return {
    text: [intro, result, rules].filter(Boolean).join("\n\n"),
    blocks: [
      { type: "markdown", text: [intro, result].filter(Boolean).join("\n\n") },
      {
        type: "card",
        card: {
          kind: "zakat",
          lang,
          icon: "🧮",
          eyebrow: pick(lang, "হার ২.৫% · হানাফি নিসাব", "Rate 2.5% · Hanafi nisab"),
          headline: pick(lang, "যাকাত ক্যালকুলেটর", "Zakat calculator"),
          subline: pick(
            lang,
            "সম্পদের পরিমাণ লিখুন বা বদলান, হিসাব সাথে সাথে হবে",
            "Enter or change amounts and the result updates instantly",
          ),
          zakat: { prices, assets },
        },
      },
      { type: "markdown", text: rules },
    ],
  };
}
