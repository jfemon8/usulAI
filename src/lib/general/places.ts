import { GENERAL_ASSISTANT_CONFIG } from "@/config/site";
import { composeNukta } from "@/lib/utils/bangla";
import { createLru } from "@/lib/utils/lru";
import { logger } from "@/lib/utils/logger";

export interface Place {
  bn: string;
  en: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

interface KnownPlace extends Place {
  aliases: string[];
}

const KNOWN_PLACES: KnownPlace[] = [
  {
    bn: "ঢাকা",
    en: "Dhaka",
    latitude: 23.8103,
    longitude: 90.4125,
    timeZone: "Asia/Dhaka",
    aliases: ["ঢাকা", "dhaka", "dacca"],
  },
  {
    bn: "চট্টগ্রাম",
    en: "Chattogram",
    latitude: 22.3569,
    longitude: 91.7832,
    timeZone: "Asia/Dhaka",
    aliases: ["চট্টগ্রাম", "চট্রগ্রাম", "চিটাগাং", "chattogram", "chittagong", "ctg", "chittagang"],
  },
  {
    bn: "সিলেট",
    en: "Sylhet",
    latitude: 24.8949,
    longitude: 91.8687,
    timeZone: "Asia/Dhaka",
    aliases: ["সিলেট", "sylhet", "silet"],
  },
  {
    bn: "রাজশাহী",
    en: "Rajshahi",
    latitude: 24.3745,
    longitude: 88.6042,
    timeZone: "Asia/Dhaka",
    aliases: ["রাজশাহী", "রাজশাহি", "rajshahi", "rajshai"],
  },
  {
    bn: "খুলনা",
    en: "Khulna",
    latitude: 22.8456,
    longitude: 89.5403,
    timeZone: "Asia/Dhaka",
    aliases: ["খুলনা", "khulna"],
  },
  {
    bn: "বরিশাল",
    en: "Barishal",
    latitude: 22.701,
    longitude: 90.3535,
    timeZone: "Asia/Dhaka",
    aliases: ["বরিশাল", "barishal", "barisal"],
  },
  {
    bn: "রংপুর",
    en: "Rangpur",
    latitude: 25.7439,
    longitude: 89.2752,
    timeZone: "Asia/Dhaka",
    aliases: ["রংপুর", "rangpur", "rongpur"],
  },
  {
    bn: "ময়মনসিংহ",
    en: "Mymensingh",
    latitude: 24.7471,
    longitude: 90.4203,
    timeZone: "Asia/Dhaka",
    aliases: ["ময়মনসিংহ", "mymensingh", "moymonsingh"],
  },
  {
    bn: "কুমিল্লা",
    en: "Cumilla",
    latitude: 23.4607,
    longitude: 91.1809,
    timeZone: "Asia/Dhaka",
    aliases: ["কুমিল্লা", "cumilla", "comilla", "kumilla"],
  },
  {
    bn: "নারায়ণগঞ্জ",
    en: "Narayanganj",
    latitude: 23.6238,
    longitude: 90.5,
    timeZone: "Asia/Dhaka",
    aliases: ["নারায়ণগঞ্জ", "নারায়নগঞ্জ", "narayanganj", "narayangonj"],
  },
  {
    bn: "গাজীপুর",
    en: "Gazipur",
    latitude: 23.9999,
    longitude: 90.4203,
    timeZone: "Asia/Dhaka",
    aliases: ["গাজীপুর", "gazipur", "gajipur"],
  },
  {
    bn: "কক্সবাজার",
    en: "Cox's Bazar",
    latitude: 21.4272,
    longitude: 92.0058,
    timeZone: "Asia/Dhaka",
    aliases: ["কক্সবাজার", "coxsbazar", "coxs bazar", "cox bazar", "coxbazar", "cox's bazar"],
  },
  {
    bn: "বগুড়া",
    en: "Bogura",
    latitude: 24.8465,
    longitude: 89.3773,
    timeZone: "Asia/Dhaka",
    aliases: ["বগুড়া", "bogura", "bogra"],
  },
  {
    bn: "যশোর",
    en: "Jashore",
    latitude: 23.1664,
    longitude: 89.2081,
    timeZone: "Asia/Dhaka",
    aliases: ["যশোর", "jashore", "jessore", "josor"],
  },
  {
    bn: "নোয়াখালী",
    en: "Noakhali",
    latitude: 22.8696,
    longitude: 91.0995,
    timeZone: "Asia/Dhaka",
    aliases: ["নোয়াখালী", "নোয়াখালি", "noakhali"],
  },
  {
    bn: "টাঙ্গাইল",
    en: "Tangail",
    latitude: 24.2513,
    longitude: 89.9167,
    timeZone: "Asia/Dhaka",
    aliases: ["টাঙ্গাইল", "tangail"],
  },
  {
    bn: "দিনাজপুর",
    en: "Dinajpur",
    latitude: 25.6217,
    longitude: 88.6354,
    timeZone: "Asia/Dhaka",
    aliases: ["দিনাজপুর", "dinajpur"],
  },
  {
    bn: "কুষ্টিয়া",
    en: "Kushtia",
    latitude: 23.9013,
    longitude: 89.1204,
    timeZone: "Asia/Dhaka",
    aliases: ["কুষ্টিয়া", "kushtia"],
  },
  {
    bn: "ফরিদপুর",
    en: "Faridpur",
    latitude: 23.6071,
    longitude: 89.8429,
    timeZone: "Asia/Dhaka",
    aliases: ["ফরিদপুর", "faridpur"],
  },
  {
    bn: "পাবনা",
    en: "Pabna",
    latitude: 24.0064,
    longitude: 89.2372,
    timeZone: "Asia/Dhaka",
    aliases: ["পাবনা", "pabna"],
  },
  {
    bn: "ব্রাহ্মণবাড়িয়া",
    en: "Brahmanbaria",
    latitude: 23.9571,
    longitude: 91.1115,
    timeZone: "Asia/Dhaka",
    aliases: ["ব্রাহ্মণবাড়িয়া", "brahmanbaria", "bbaria"],
  },
  {
    bn: "মক্কা",
    en: "Makkah",
    latitude: 21.4225,
    longitude: 39.8262,
    timeZone: "Asia/Riyadh",
    aliases: ["মক্কা", "makkah", "mecca", "makka", "mokka"],
  },
  {
    bn: "মদিনা",
    en: "Madinah",
    latitude: 24.4672,
    longitude: 39.6111,
    timeZone: "Asia/Riyadh",
    aliases: ["মদিনা", "madinah", "madina", "medina", "modina"],
  },
];

const BANGLA_SUFFIXES = ["য়ের", "এর", "ের", "তে", "য়", "র", "ে", "টা"];
const LATIN_SUFFIXES = ["er", "te", "ay", "e", "r", "y"];

const aliasIndex = new Map<string, KnownPlace>(
  KNOWN_PLACES.flatMap((place) =>
    place.aliases.map((alias) => [composeNukta(alias).toLowerCase(), place] as const),
  ),
);

export const DEFAULT_PLACE: Place = KNOWN_PLACES[0] as Place;

function stripSuffix(word: string): string[] {
  const suffixes = /[a-z]/.test(word) ? LATIN_SUFFIXES : BANGLA_SUFFIXES.map(composeNukta);
  return [
    word,
    ...suffixes
      .filter((suffix) => word.length > suffix.length + 2 && word.endsWith(suffix))
      .map((suffix) => word.slice(0, -suffix.length)),
  ];
}

function toPlace(place: KnownPlace): Place {
  return {
    bn: place.bn,
    en: place.en,
    latitude: place.latitude,
    longitude: place.longitude,
    timeZone: place.timeZone,
  };
}

export function findKnownPlace(words: string[]): Place | null {
  if (words.length === 0) return null;
  const last = words[words.length - 1] ?? "";
  const head = words.slice(0, -1);
  for (const ending of stripSuffix(last)) {
    const candidates = [[...head, ending].join(" "), [...head, ending].join("")];
    for (const candidate of candidates) {
      const place = aliasIndex.get(candidate.replace(/'/g, "").toLowerCase());
      if (place) return toPlace(place);
    }
  }
  return null;
}

interface GeocodeResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country?: string;
  population?: number;
}

const geocodeCache = createLru<{ place: Place | null; at: number }>(
  GENERAL_ASSISTANT_CONFIG.cacheEntries,
);

function comparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export async function geocodePlace(query: string): Promise<Place | null> {
  const key = query.trim().toLowerCase();
  if (key.length < 2) return null;
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.at < GENERAL_ASSISTANT_CONFIG.geocodeCacheMs) {
    return cached.place;
  }

  try {
    const url = new URL(GENERAL_ASSISTANT_CONFIG.endpoints.geocode);
    url.searchParams.set("name", key);
    url.searchParams.set("count", "5");
    url.searchParams.set("language", /[ঀ-৿]/.test(key) ? "bn" : "en");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(GENERAL_ASSISTANT_CONFIG.requestTimeoutMs),
    });
    if (!response.ok) throw new Error(`geocoding answered ${response.status}`);
    const body = (await response.json()) as { results?: GeocodeResult[] };
    const wanted = comparable(key);
    const match = (body.results ?? []).find(
      (result) =>
        result.name !== undefined &&
        typeof result.latitude === "number" &&
        typeof result.longitude === "number" &&
        comparable(result.name) === wanted,
    );
    const place: Place | null =
      match &&
      match.name &&
      typeof match.latitude === "number" &&
      typeof match.longitude === "number"
        ? {
            bn: match.name,
            en: match.country ? `${match.name}, ${match.country}` : match.name,
            latitude: match.latitude,
            longitude: match.longitude,
            timeZone: match.timezone ?? "UTC",
          }
        : null;
    geocodeCache.set(key, { place, at: Date.now() });
    return place;
  } catch (error) {
    logger.warn("Place lookup failed", { error: String(error).slice(0, 160) });
    return null;
  }
}

export async function resolvePlace(words: string[]): Promise<Place | null> {
  if (words.length === 0 || words.length > GENERAL_ASSISTANT_CONFIG.maxPlaceWords) return null;
  const known = findKnownPlace(words);
  if (known) return known;

  const last = words[words.length - 1] ?? "";
  for (const ending of stripSuffix(last)) {
    const place = await geocodePlace([...words.slice(0, -1), ending].join(" "));
    if (place) return place;
  }
  return null;
}

export async function placeForTimeZone(timeZone: string): Promise<Place> {
  if (timeZone === DEFAULT_PLACE.timeZone) return DEFAULT_PLACE;
  const city = timeZone.split("/").pop()?.replace(/_/g, " ");
  if (!city) return DEFAULT_PLACE;
  const place = await geocodePlace(city);
  return place && place.timeZone === timeZone ? place : DEFAULT_PLACE;
}

export function placeName(place: Place, lang: "bn" | "en"): string {
  return lang === "bn" ? place.bn : place.en;
}
