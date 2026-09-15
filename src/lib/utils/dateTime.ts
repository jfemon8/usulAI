import { DATE_TIME_CONFIG } from "@/config/site";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(DATE_TIME_CONFIG.locale, {
      timeZone,
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h12",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function formatTimestamp(
  value: Date | string | number,
  options: { timeZone?: string } = {},
): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    formatterFor(options.timeZone ?? DATE_TIME_CONFIG.timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const period = String(parts.dayPeriod ?? "").toUpperCase();
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}:${parts.second} ${period}`;
}
