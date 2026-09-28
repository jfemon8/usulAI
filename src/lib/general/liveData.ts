import { GENERAL_ASSISTANT_CONFIG } from "@/config/site";
import { createLru } from "@/lib/utils/lru";
import { logger } from "@/lib/utils/logger";
import type { CalendarDate } from "@/lib/general/calendar";
import type { Place } from "@/lib/general/places";

export interface WeatherDay {
  date: string;
  code: number;
  max: number;
  min: number;
  rainChance: number | null;
  sunrise: string | null;
  sunset: string | null;
  uvIndex: number | null;
}

export interface WeatherReport {
  observedAt: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windKmh: number;
  code: number;
  isDay: boolean;
  days: WeatherDay[];
}

export type PrayerTimings = Record<
  "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha",
  string
>;

const cache = createLru<{ value: unknown; at: number }>(GENERAL_ASSISTANT_CONFIG.cacheEntries);

async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.value as T;
  const value = await load();
  cache.set(key, { value, at: Date.now() });
  return value;
}

async function getJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(GENERAL_ASSISTANT_CONFIG.requestTimeoutMs),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${url.hostname} answered ${response.status}`);
  return response.json();
}

function coordinateKey(place: Place): string {
  return `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
}

function numberAt(values: unknown, index: number): number | null {
  if (!Array.isArray(values)) return null;
  const value: unknown = values[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringAt(values: unknown, index: number): string | null {
  if (!Array.isArray(values)) return null;
  const value: unknown = values[index];
  return typeof value === "string" ? value : null;
}

interface OpenMeteoBody {
  current?: Record<string, unknown>;
  daily?: Record<string, unknown>;
}

export function parseWeather(body: OpenMeteoBody): WeatherReport | null {
  const current = body.current;
  const daily = body.daily;
  if (!current || !daily) return null;
  const read = (key: string) => {
    const value = current[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const temperature = read("temperature_2m");
  const code = read("weather_code");
  if (temperature === null || code === null) return null;

  const dates = Array.isArray(daily.time) ? (daily.time as unknown[]) : [];
  const days: WeatherDay[] = dates.flatMap((date, index) => {
    const max = numberAt(daily.temperature_2m_max, index);
    const min = numberAt(daily.temperature_2m_min, index);
    if (typeof date !== "string" || max === null || min === null) return [];
    return [
      {
        date,
        code: numberAt(daily.weather_code, index) ?? code,
        max,
        min,
        rainChance: numberAt(daily.precipitation_probability_max, index),
        sunrise: stringAt(daily.sunrise, index),
        sunset: stringAt(daily.sunset, index),
        uvIndex: numberAt(daily.uv_index_max, index),
      },
    ];
  });

  return {
    observedAt: typeof current.time === "string" ? current.time : "",
    temperature,
    feelsLike: read("apparent_temperature") ?? temperature,
    humidity: read("relative_humidity_2m") ?? 0,
    windKmh: read("wind_speed_10m") ?? 0,
    code,
    isDay: read("is_day") !== 0,
    days,
  };
}

export async function fetchWeather(place: Place): Promise<WeatherReport | null> {
  try {
    return await cached(
      `weather:${coordinateKey(place)}`,
      GENERAL_ASSISTANT_CONFIG.weatherCacheMs,
      async () => {
        const url = new URL(GENERAL_ASSISTANT_CONFIG.endpoints.weather);
        url.searchParams.set("latitude", String(place.latitude));
        url.searchParams.set("longitude", String(place.longitude));
        url.searchParams.set(
          "current",
          "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
        );
        url.searchParams.set(
          "daily",
          "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
        );
        url.searchParams.set("timezone", place.timeZone);
        url.searchParams.set("forecast_days", "2");
        const report = parseWeather((await getJson(url)) as OpenMeteoBody);
        if (!report) throw new Error("weather response had no current reading");
        return report;
      },
    );
  } catch (error) {
    logger.warn("Weather lookup failed", { error: String(error).slice(0, 160) });
    return null;
  }
}

const TIMING_KEYS = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
} as const;

export function parsePrayerTimings(body: unknown): PrayerTimings | null {
  const timings = (body as { data?: { timings?: Record<string, unknown> } } | null)?.data?.timings;
  if (!timings) return null;
  const result: Partial<PrayerTimings> = {};
  for (const [key, source] of Object.entries(TIMING_KEYS) as [keyof PrayerTimings, string][]) {
    const value = timings[source];
    if (typeof value !== "string") return null;
    const clock = /\d{1,2}:\d{2}/.exec(value)?.[0];
    if (!clock) return null;
    result[key] = clock;
  }
  return result as PrayerTimings;
}

export async function fetchPrayerTimes(
  place: Place,
  date: CalendarDate,
): Promise<PrayerTimings | null> {
  const day = `${String(date.day).padStart(2, "0")}-${String(date.month).padStart(2, "0")}-${date.year}`;
  try {
    return await cached(
      `prayer:${coordinateKey(place)}:${day}`,
      GENERAL_ASSISTANT_CONFIG.prayerCacheMs,
      async () => {
        const url = new URL(`${GENERAL_ASSISTANT_CONFIG.endpoints.prayer}/${day}`);
        url.searchParams.set("latitude", String(place.latitude));
        url.searchParams.set("longitude", String(place.longitude));
        url.searchParams.set("method", String(GENERAL_ASSISTANT_CONFIG.prayer.method));
        url.searchParams.set("school", String(GENERAL_ASSISTANT_CONFIG.prayer.school));
        url.searchParams.set("timezonestring", place.timeZone);
        const timings = parsePrayerTimings(await getJson(url));
        if (!timings) throw new Error("prayer time response had no timings");
        return timings;
      },
    );
  } catch (error) {
    logger.warn("Prayer time lookup failed", { error: String(error).slice(0, 160) });
    return null;
  }
}
