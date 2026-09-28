import { composeNukta } from "@/lib/utils/bangla";
import type { ZakatAssets, ZakatPrices } from "@/types";

function normalizedKeys<T>(map: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [composeNukta(key), value]));
}

export const VORI_GRAMS = 11.664;
export const GOLD_NISAB_GRAMS = 87.48;
export const SILVER_NISAB_GRAMS = 612.36;
export const ZAKAT_RATE = 0.025;
export const DEFAULT_GOLD_KARAT = 22;

export type NisabBasis = "gold" | "silver";

export interface ZakatResult {
  goldValue: number;
  silverValue: number;
  gross: number;
  net: number;
  basis: NisabBasis;
  nisabValue: number | null;
  meetsNisab: boolean | null;
  due: number;
  missingPrice: boolean;
}

export function emptyAssets(): ZakatAssets {
  return {
    cash: 0,
    business: 0,
    receivables: 0,
    goldGrams: 0,
    goldKarat: DEFAULT_GOLD_KARAT,
    goldValue: 0,
    silverGrams: 0,
    silverValue: 0,
    debts: 0,
  };
}

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function computeZakat(assets: ZakatAssets, prices: ZakatPrices): ZakatResult {
  const karat = Math.min(24, Math.max(1, assets.goldKarat || DEFAULT_GOLD_KARAT));
  const goldPerGram = prices.goldPerGram === null ? null : prices.goldPerGram * (karat / 24);
  const silverPerGram = prices.silverPerGram;
  const goldGrams = positive(assets.goldGrams);
  const silverGrams = positive(assets.silverGrams);

  const goldValue =
    positive(assets.goldValue) + (goldPerGram === null ? 0 : goldGrams * goldPerGram);
  const silverValue =
    positive(assets.silverValue) + (silverPerGram === null ? 0 : silverGrams * silverPerGram);
  const others = positive(assets.cash) + positive(assets.business) + positive(assets.receivables);
  const gross = others + goldValue + silverValue;
  const net = Math.max(0, gross - positive(assets.debts));

  const hasGold = goldGrams > 0 || positive(assets.goldValue) > 0;
  const onlyGold =
    hasGold && others === 0 && silverGrams === 0 && positive(assets.silverValue) === 0;
  const basis: NisabBasis = onlyGold ? "gold" : "silver";
  const nisabValue =
    basis === "gold"
      ? goldPerGram === null
        ? null
        : GOLD_NISAB_GRAMS * goldPerGram
      : silverPerGram === null
        ? null
        : SILVER_NISAB_GRAMS * silverPerGram;

  const missingPrice =
    (goldGrams > 0 && goldPerGram === null) ||
    (silverGrams > 0 && silverPerGram === null) ||
    nisabValue === null;

  let meetsNisab: boolean | null = nisabValue === null ? null : net >= nisabValue;
  if (basis === "gold" && goldPerGram === null && positive(assets.goldValue) === 0) {
    meetsNisab = goldGrams >= GOLD_NISAB_GRAMS && positive(assets.debts) === 0 ? true : null;
  }

  const due = meetsNisab && !missingPrice ? net * ZAKAT_RATE : 0;
  return { goldValue, silverValue, gross, net, basis, nisabValue, meetsNisab, due, missingPrice };
}

const DIGITS: Record<string, string> = Object.fromEntries(
  [..."০১২৩৪৫৬৭৮৯"].map((digit, index) => [digit, String(index)]),
);

export function parseNumber(token: string): number | null {
  const latin = token.replace(/[০-৯]/g, (digit) => DIGITS[digit] ?? digit);
  if (!/^\d+(?:\.\d+)?$/.test(latin)) return null;
  const value = Number(latin);
  return Number.isFinite(value) ? value : null;
}

const MULTIPLIERS: Record<string, number> = normalizedKeys({
  লাখ: 1e5,
  লক্ষ: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  lak: 1e5,
  হাজার: 1e3,
  hazar: 1e3,
  hajar: 1e3,
  thousand: 1e3,
  k: 1e3,
  কোটি: 1e7,
  koti: 1e7,
  crore: 1e7,
  cr: 1e7,
  million: 1e6,
});

type Unit = "taka" | "vori" | "gram" | "karat";
type Asset = "gold" | "silver" | "debt" | "business" | "receivable" | "cash";

const UNITS: Record<string, Unit> = normalizedKeys({
  ...Object.fromEntries(
    ["টাকা", "টাকার", "tk", "taka", "takar", "bdt"].map((word) => [word, "taka" as const]),
  ),
  ...Object.fromEntries(
    ["ভরি", "ভরির", "vori", "bhori", "tola", "তোলা", "voris", "bhoris"].map((word) => [
      word,
      "vori" as const,
    ]),
  ),
  ...Object.fromEntries(
    ["গ্রাম", "gram", "grams", "gm", "g", "grm"].map((word) => [word, "gram" as const]),
  ),
  ...Object.fromEntries(
    ["ক্যারেট", "ক্যারেটের", "carat", "karat", "krt", "kt"].map((word) => [word, "karat" as const]),
  ),
});

const ASSETS: Record<string, Asset> = normalizedKeys({
  ...Object.fromEntries(
    [
      "সোনা",
      "সোনার",
      "স্বর্ণ",
      "স্বর্ণের",
      "গহনা",
      "গয়না",
      "অলংকার",
      "gold",
      "sona",
      "sonar",
      "shorno",
      "sorno",
      "swarna",
      "jewelry",
      "jewellery",
      "gohona",
      "goyna",
    ].map((word) => [word, "gold" as const]),
  ),
  ...Object.fromEntries(
    ["রুপা", "রূপা", "রুপার", "রূপার", "silver", "rupa", "rupar", "rupo"].map((word) => [
      word,
      "silver" as const,
    ]),
  ),
  ...Object.fromEntries(
    [
      "ঋণ",
      "ঋণের",
      "দেনা",
      "কর্জ",
      "ধার",
      "loan",
      "loans",
      "debt",
      "debts",
      "rin",
      "dena",
      "karj",
      "dhar",
      "liability",
      "liabilities",
    ].map((word) => [word, "debt" as const]),
  ),
  ...Object.fromEntries(
    [
      "ব্যবসা",
      "ব্যবসার",
      "ব্যবসায়িক",
      "পণ্য",
      "মাল",
      "business",
      "stock",
      "inventory",
      "goods",
      "merchandise",
      "byabsa",
      "bebsha",
      "bebsa",
      "bebshar",
      "ponno",
    ].map((word) => [word, "business" as const]),
  ),
  ...Object.fromEntries(
    ["পাওনা", "paona", "pawna", "receivable", "receivables", "owed"].map((word) => [
      word,
      "receivable" as const,
    ]),
  ),
  ...Object.fromEntries(
    [
      "নগদ",
      "ব্যাংক",
      "ব্যাংকে",
      "সঞ্চয়",
      "সঞ্চয়পত্র",
      "শেয়ার",
      "জমা",
      "cash",
      "bank",
      "banke",
      "savings",
      "saving",
      "fdr",
      "dps",
      "sanchaypatra",
      "share",
      "shares",
      "deposit",
      "deposits",
      "joma",
      "nogod",
      "nagad",
    ].map((word) => [word, "cash" as const]),
  ),
});

const SEPARATORS = new Set(
  ["and", "o", "ar", "এবং", "ও", "আর", "plus", "with", "soho", "সহ"].map(composeNukta),
);

export const ZAKAT_AMOUNT_WORDS = new Set([
  ...Object.keys(MULTIPLIERS),
  ...Object.keys(UNITS),
  ...Object.keys(ASSETS),
  ...SEPARATORS,
]);

export function isAmountToken(token: string): boolean {
  return parseNumber(token) !== null;
}

interface Segment {
  amounts: { value: number; unit: Unit | null }[];
  asset: Asset | null;
}

function segmentsOf(tokens: string[]): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = { amounts: [], asset: null };
  const flush = () => {
    if (current.amounts.length > 0 || current.asset) segments.push(current);
    current = { amounts: [], asset: null };
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (SEPARATORS.has(token)) {
      flush();
      continue;
    }
    const asset = ASSETS[token];
    if (asset) {
      if (current.asset && current.asset !== asset && current.amounts.length > 0) flush();
      current.asset = asset;
      continue;
    }
    const number = parseNumber(token);
    if (number === null) continue;

    let value = number;
    let cursor = index + 1;
    const multiplier = MULTIPLIERS[tokens[cursor] ?? ""];
    if (multiplier) {
      value *= multiplier;
      cursor += 1;
    }
    const unit = UNITS[tokens[cursor] ?? ""] ?? null;
    if (unit) cursor += 1;
    if (current.amounts.length > 0 && current.asset) flush();
    current.amounts.push({ value, unit });
    index = cursor - 1;
  }
  flush();
  return segments;
}

export function parseZakatAssets(tokens: string[]): { assets: ZakatAssets; found: boolean } {
  const assets = emptyAssets();
  let found = false;

  for (const segment of segmentsOf(tokens)) {
    for (const { value, unit } of segment.amounts) {
      if (unit === "karat") {
        if (value >= 8 && value <= 24) assets.goldKarat = value;
        continue;
      }
      found = true;
      const weight = unit === "vori" ? value * VORI_GRAMS : unit === "gram" ? value : null;
      switch (segment.asset) {
        case "gold":
          if (weight !== null) assets.goldGrams += weight;
          else if (unit === "taka" || value > 500) assets.goldValue += value;
          else assets.goldGrams += value * VORI_GRAMS;
          break;
        case "silver":
          if (weight !== null) assets.silverGrams += weight;
          else if (unit === "taka" || value > 5000) assets.silverValue += value;
          else assets.silverGrams += value * VORI_GRAMS;
          break;
        case "debt":
          assets.debts += value;
          break;
        case "business":
          assets.business += value;
          break;
        case "receivable":
          assets.receivables += value;
          break;
        default:
          if (weight === null) assets.cash += value;
      }
    }
  }
  return { assets, found };
}
