import { GENERAL_ASSISTANT_CONFIG } from "@/config/site";

const DAY_MS = 86_400_000;
const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

export const WEEKDAYS = {
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
} as const;

const GREGORIAN_MONTHS = {
  bn: [
    "জানুয়ারি",
    "ফেব্রুয়ারি",
    "মার্চ",
    "এপ্রিল",
    "মে",
    "জুন",
    "জুলাই",
    "আগস্ট",
    "সেপ্টেম্বর",
    "অক্টোবর",
    "নভেম্বর",
    "ডিসেম্বর",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
} as const;

const BENGALI_MONTHS = {
  bn: [
    "বৈশাখ",
    "জ্যৈষ্ঠ",
    "আষাঢ়",
    "শ্রাবণ",
    "ভাদ্র",
    "আশ্বিন",
    "কার্তিক",
    "অগ্রহায়ণ",
    "পৌষ",
    "মাঘ",
    "ফাল্গুন",
    "চৈত্র",
  ],
  en: [
    "Boishakh",
    "Jyoishtho",
    "Asharh",
    "Shrabon",
    "Bhadro",
    "Ashwin",
    "Kartik",
    "Ogrohayon",
    "Poush",
    "Magh",
    "Falgun",
    "Choitro",
  ],
} as const;

const HIJRI_MONTHS = {
  bn: [
    "মুহাররম",
    "সফর",
    "রবিউল আউয়াল",
    "রবিউস সানি",
    "জমাদিউল আউয়াল",
    "জমাদিউস সানি",
    "রজব",
    "শাবান",
    "রমজান",
    "শাওয়াল",
    "জিলকদ",
    "জিলহজ",
  ],
  en: [
    "Muharram",
    "Safar",
    "Rabi al-Awwal",
    "Rabi al-Thani",
    "Jumada al-Ula",
    "Jumada al-Akhirah",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhul-Qa'dah",
    "Dhul-Hijjah",
  ],
} as const;

export type Lang = "bn" | "en";

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
}

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export function bengaliDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => BENGALI_DIGITS[Number(digit)] ?? digit);
}

export function localDigits(value: string | number, lang: Lang): string {
  return lang === "bn" ? bengaliDigits(value) : String(value);
}

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(now: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = read("year");
  const month = read("month");
  const day = read("day");

  return {
    year,
    month,
    day,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    hour: read("hour") % 24,
    minute: read("minute"),
  };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function bengaliCalendarDate({ year, month, day }: CalendarDate): CalendarDate {
  const date = Date.UTC(year, month - 1, day);
  let bengaliYear = year - 593;
  let start = Date.UTC(year, 3, 14);
  if (date < start) {
    bengaliYear -= 1;
    start = Date.UTC(year - 1, 3, 14);
  }

  const lengths = [
    31,
    31,
    31,
    31,
    31,
    31,
    30,
    30,
    30,
    30,
    isLeapYear(bengaliYear + 594) ? 30 : 29,
    30,
  ];
  let offset = Math.round((date - start) / DAY_MS);
  let index = 0;
  while (index < lengths.length - 1 && offset >= (lengths[index] ?? 30)) {
    offset -= lengths[index] ?? 30;
    index += 1;
  }

  return { year: bengaliYear, month: index + 1, day: offset + 1 };
}

export function hijriCalendarDate(
  { year, month, day }: CalendarDate,
  offsetDays: number = GENERAL_ASSISTANT_CONFIG.hijriDayOffset,
): CalendarDate | null {
  try {
    const moment = new Date(Date.UTC(year, month - 1, day, 12) + offsetDays * DAY_MS);
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(moment);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number.parseInt(parts.find((part) => part.type === type)?.value ?? "", 10);
    const result = { year: read("year"), month: read("month"), day: read("day") };
    if (![result.year, result.month, result.day].every(Number.isFinite)) return null;
    if (result.month < 1 || result.month > 12) return null;
    return result;
  } catch {
    return null;
  }
}

export function gregorianLabel(date: CalendarDate, lang: Lang): string {
  const month = GREGORIAN_MONTHS[lang][date.month - 1] ?? "";
  return lang === "bn"
    ? `${bengaliDigits(date.day)} ${month} ${bengaliDigits(date.year)}`
    : `${date.day} ${month} ${date.year}`;
}

export function bengaliLabel(date: CalendarDate, lang: Lang): string {
  const month = BENGALI_MONTHS[lang][date.month - 1] ?? "";
  return lang === "bn"
    ? `${bengaliDigits(date.day)} ${month} ${bengaliDigits(date.year)} বঙ্গাব্দ`
    : `${date.day} ${month} ${date.year} BS`;
}

export function hijriLabel(date: CalendarDate, lang: Lang): string {
  const month = HIJRI_MONTHS[lang][date.month - 1] ?? "";
  return lang === "bn"
    ? `${bengaliDigits(date.day)} ${month} ${bengaliDigits(date.year)} হিজরি`
    : `${date.day} ${month} ${date.year} AH`;
}

export function dayPeriod(hour: number): string {
  if (hour >= 4 && hour < 6) return "ভোর";
  if (hour >= 6 && hour < 12) return "সকাল";
  if (hour >= 12 && hour < 15) return "দুপুর";
  if (hour >= 15 && hour < 18) return "বিকেল";
  if (hour >= 18 && hour < 19) return "সন্ধ্যা";
  return "রাত";
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function clockLabel(hour: number, minute: number, lang: Lang): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  if (lang === "en") return `${twelve}:${twoDigits(minute)} ${hour < 12 ? "AM" : "PM"}`;
  return `${dayPeriod(hour)} ${bengaliDigits(`${twelve}:${twoDigits(minute)}`)}`;
}

export function spokenClock(hour: number, minute: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  const minutes = minute === 0 ? "" : ` ${bengaliDigits(minute)} মিনিট`;
  return `${dayPeriod(hour)} ${bengaliDigits(twelve)}টা${minutes}`;
}

export function parseClock(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const moment = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS);
  return {
    year: moment.getUTCFullYear(),
    month: moment.getUTCMonth() + 1,
    day: moment.getUTCDate(),
  };
}

export function nextHijriDate(
  from: CalendarDate,
  month: number,
  day: number,
  maxDays = 400,
): { date: CalendarDate; daysAway: number } | null {
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const date = addDays(from, offset);
    const hijri = hijriCalendarDate(date);
    if (hijri && hijri.month === month && hijri.day === day) return { date, daysAway: offset };
  }
  return null;
}

export function weekdayOf(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}
