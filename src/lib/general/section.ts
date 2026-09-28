import type { GeneralBlock, GeneralCard } from "@/types";
import {
  clockLabel,
  parseClock,
  zonedParts,
  type CalendarDate,
  type Lang,
} from "@/lib/general/calendar";
import type { DetectedClause } from "@/lib/general/intents";
import type { PrayerTimings } from "@/lib/general/liveData";
import { placeForTimeZone, placeName, resolvePlace, type Place } from "@/lib/general/places";

export interface Section {
  text: string;
  card?: GeneralCard;
  blocks?: GeneralBlock[];
}

export interface Context {
  lang: Lang;
  now: Date;
  timeZone: string;
}

export function pick(lang: Lang, bn: string, en: string): string {
  return lang === "bn" ? bn : en;
}

export function todayIn(
  timeZone: string,
  now: Date,
): CalendarDate & { hour: number; minute: number } {
  const parts = zonedParts(now, timeZone);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

export async function placeFor(clause: DetectedClause, context: Context): Promise<Place | null> {
  if (clause.placeWords.length > 0) return resolvePlace(clause.placeWords);
  return placeForTimeZone(context.timeZone);
}

export function unavailable(lang: Lang, what: { bn: string; en: string }, place: Place): Section {
  return {
    text: pick(
      lang,
      `দুঃখিত, এই মুহূর্তে ${placeName(place, "bn")}-এর ${what.bn} আনা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।`,
      `Sorry, I couldn't fetch the ${what.en} for ${placeName(place, "en")} right now. Please try again shortly.`,
    ),
  };
}

export const PRAYER_ROWS: {
  key: keyof PrayerTimings;
  bn: string;
  en: string;
  period?: string;
  of?: string;
}[] = [
  { key: "fajr", bn: "ফজর", en: "Fajr", of: "ফজরের" },
  { key: "sunrise", bn: "সূর্যোদয় (ফজরের শেষ)", en: "Sunrise (Fajr ends)" },
  { key: "dhuhr", bn: "যোহর", en: "Dhuhr", of: "যোহরের" },
  { key: "asr", bn: "আসর", en: "Asr", of: "আসরের" },
  { key: "maghrib", bn: "মাগরিব", en: "Maghrib", period: "সন্ধ্যা", of: "মাগরিবের" },
  { key: "isha", bn: "এশা", en: "Isha", period: "রাত", of: "এশার" },
];

export function prayerClock(value: string, lang: Lang, period?: string): string {
  const clock = parseClock(value);
  if (!clock) return value;
  const label = clockLabel(clock.hour, clock.minute, lang);
  if (lang !== "bn" || !period) return label;
  return label.replace(/^\S+/, period);
}

export function minutesOf(value: string): number {
  const clock = parseClock(value);
  return clock ? clock.hour * 60 + clock.minute : 0;
}

const OPEN = "⟦";
const CLOSE = "⟧";
const MARKER = new RegExp(`${OPEN}([^${CLOSE}]+)${CLOSE}`, "g");

export function cite(...references: string[]): string {
  return references.map((reference) => `${OPEN}${reference}${CLOSE}`).join("");
}

export function citedReferences(text: string): string[] {
  return [...new Set([...text.matchAll(MARKER)].map((match) => match[1] ?? ""))].filter(Boolean);
}

export function resolveCitations(text: string, indexOf: Map<string, number>): string {
  return text
    .replace(MARKER, (_, reference: string) => {
      const index = indexOf.get(reference);
      return index === undefined ? "" : ` [${index}]`;
    })
    .replace(/(\] )\[/g, "][")
    .replace(/ +(?=[।.,;:)])/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/(\S)  +\[/g, "$1 [");
}

export function money(value: number, lang: Lang): string {
  const rounded = Math.round(value);
  return lang === "bn"
    ? `৳${new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 }).format(rounded)}`
    : `BDT ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rounded)}`;
}

export function amount(value: number, lang: Lang, digits = 2): string {
  return new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-IN", {
    maximumFractionDigits: digits,
  }).format(value);
}
