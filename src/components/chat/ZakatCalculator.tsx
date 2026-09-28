"use client";

import { useId, useMemo, useState } from "react";
import { clsx } from "clsx";
import { computeZakat, DEFAULT_GOLD_KARAT, VORI_GRAMS } from "@/lib/general/zakatMath";
import type { GeneralCard, ZakatAssets, ZakatPrices } from "@/types";

type Lang = GeneralCard["lang"];

const KARATS = [24, 22, 21, 18];

function text(lang: Lang, bn: string, en: string): string {
  return lang === "bn" ? bn : en;
}

function toNumber(value: string): number {
  const latin = value
    .replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6))
    .replace(/[,\s]/g, "");
  const parsed = Number(latin);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function format(value: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-IN", {
    maximumFractionDigits: digits,
  }).format(value);
}

function money(value: number, lang: Lang): string {
  return lang === "bn" ? `৳${format(value, lang)}` : `BDT ${format(value, lang)}`;
}

function initial(value: number, digits = 2): string {
  if (!value) return "";
  return String(Math.round(value * 10 ** digits) / 10 ** digits);
}

interface Fields {
  cash: string;
  business: string;
  receivables: string;
  goldVori: string;
  goldKarat: number;
  silverVori: string;
  debts: string;
  goldPrice: string;
  silverPrice: string;
}

function initialFields(assets: ZakatAssets, prices: ZakatPrices): Fields {
  const goldVoriPrice = prices.goldPerGram === null ? 0 : prices.goldPerGram * VORI_GRAMS;
  const silverVoriPrice = prices.silverPerGram === null ? 0 : prices.silverPerGram * VORI_GRAMS;
  const karat = assets.goldKarat || DEFAULT_GOLD_KARAT;
  const goldFromValue =
    assets.goldValue > 0 && goldVoriPrice > 0
      ? assets.goldValue / (goldVoriPrice * (karat / 24))
      : 0;
  const silverFromValue =
    assets.silverValue > 0 && silverVoriPrice > 0 ? assets.silverValue / silverVoriPrice : 0;

  return {
    cash: initial(assets.cash, 0),
    business: initial(assets.business, 0),
    receivables: initial(assets.receivables, 0),
    goldVori: initial(assets.goldGrams / VORI_GRAMS + goldFromValue),
    goldKarat: KARATS.includes(karat) ? karat : DEFAULT_GOLD_KARAT,
    silverVori: initial(assets.silverGrams / VORI_GRAMS + silverFromValue),
    debts: initial(assets.debts, 0),
    goldPrice: initial(goldVoriPrice, 0),
    silverPrice: initial(silverVoriPrice, 0),
  };
}

function Field({
  label,
  hint,
  value,
  onChange,
  suffix,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-(--text-2)">
        {label}
      </label>
      <div className="mt-1 flex items-center rounded-xl border border-(--border) bg-(--bg) px-3 focus-within:border-(--accent) focus-within:ring-2 focus-within:ring-(--accent-ring)">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder="0"
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full min-w-0 bg-transparent text-base text-(--text-1) tabular-nums outline-none placeholder:text-(--text-3)"
        />
        <span className="shrink-0 ps-2 text-xs text-(--text-3)">{suffix}</span>
      </div>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-(--text-3)">{hint}</p> : null}
    </div>
  );
}

export function ZakatCalculator({
  lang,
  prices,
  assets,
}: {
  lang: Lang;
  prices: ZakatPrices;
  assets: ZakatAssets;
}) {
  const [fields, setFields] = useState<Fields>(() => initialFields(assets, prices));
  const set = (key: keyof Fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));
  const taka = text(lang, "টাকা", "BDT");
  const vori = text(lang, "ভরি", "tola");

  const result = useMemo(() => {
    const goldPrice = toNumber(fields.goldPrice);
    const silverPrice = toNumber(fields.silverPrice);
    return computeZakat(
      {
        cash: toNumber(fields.cash),
        business: toNumber(fields.business),
        receivables: toNumber(fields.receivables),
        goldGrams: toNumber(fields.goldVori) * VORI_GRAMS,
        goldKarat: fields.goldKarat,
        goldValue: 0,
        silverGrams: toNumber(fields.silverVori) * VORI_GRAMS,
        silverValue: 0,
        debts: toNumber(fields.debts),
      },
      {
        goldPerGram: goldPrice > 0 ? goldPrice / VORI_GRAMS : null,
        silverPerGram: silverPrice > 0 ? silverPrice / VORI_GRAMS : null,
        source: prices.source,
        updatedAt: prices.updatedAt,
      },
    );
  }, [fields, prices.source, prices.updatedAt]);

  const status =
    result.meetsNisab === null
      ? {
          tone: "neutral",
          label: text(lang, "দাম লিখলে নিসাব যাচাই হবে", "Enter prices to check the nisab"),
        }
      : result.meetsNisab
        ? {
            tone: "due",
            label: text(lang, "নিসাব পূর্ণ, যাকাত ফরজ", "Nisab reached, zakat is due"),
          }
        : { tone: "clear", label: text(lang, "নিসাব পূর্ণ হয়নি", "Below the nisab") };

  return (
    <div className="relative mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={text(lang, "নগদ, ব্যাংক ও সঞ্চয়", "Cash, bank and savings")}
          value={fields.cash}
          onChange={set("cash")}
          suffix={taka}
        />
        <Field
          label={text(lang, "ব্যবসার পণ্য (বিক্রয়মূল্যে)", "Business stock (sale value)")}
          value={fields.business}
          onChange={set("business")}
          suffix={taka}
        />
        <Field
          label={text(lang, "পাওনা টাকা", "Money owed to you")}
          hint={text(lang, "যা ফেরত পাওয়ার আশা আছে", "That you expect to recover")}
          value={fields.receivables}
          onChange={set("receivables")}
          suffix={taka}
        />
        <Field
          label={text(lang, "এখনই পরিশোধযোগ্য ঋণ", "Debts due now")}
          hint={text(lang, "মোট সম্পদ থেকে বাদ যাবে", "Deducted from the total")}
          value={fields.debts}
          onChange={set("debts")}
          suffix={taka}
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field
            label={text(lang, "সোনা (গহনাসহ)", "Gold (including jewellery)")}
            hint={text(lang, "১ ভরি = ১১.৬৬৪ গ্রাম", "1 tola = 11.664 g")}
            value={fields.goldVori}
            onChange={set("goldVori")}
            suffix={vori}
          />
          <div>
            <label className="block text-xs font-medium text-(--text-2)">
              {text(lang, "ক্যারেট", "Carat")}
              <select
                value={fields.goldKarat}
                onChange={(event) =>
                  setFields((current) => ({ ...current, goldKarat: Number(event.target.value) }))
                }
                className="mt-1 block h-10.5 rounded-xl border border-(--border) bg-(--bg) px-2 text-base text-(--text-1)"
              >
                {KARATS.map((karat) => (
                  <option key={karat} value={karat}>
                    {format(karat, lang)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <Field
          label={text(lang, "রুপা", "Silver")}
          value={fields.silverVori}
          onChange={set("silverVori")}
          suffix={vori}
        />
      </div>

      <details className="rounded-xl bg-(--surface-2) px-3 py-2 text-sm">
        <summary className="text-xs font-medium text-(--text-2)">
          {text(
            lang,
            "সোনা ও রুপার দাম (প্রতি ভরি) বদলান",
            "Adjust gold and silver prices (per tola)",
          )}
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 pb-1 sm:grid-cols-2">
          <Field
            label={text(lang, "সোনার দাম, ২৪ ক্যারেট", "Gold price, 24 carat")}
            value={fields.goldPrice}
            onChange={set("goldPrice")}
            suffix={taka}
          />
          <Field
            label={text(lang, "রুপার দাম", "Silver price")}
            value={fields.silverPrice}
            onChange={set("silverPrice")}
            suffix={taka}
          />
        </div>
      </details>

      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-(--border) bg-(--surface-2) p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-(--text-3)">
            {text(lang, "যাকাতযোগ্য মোট সম্পদ", "Net zakatable wealth")}
          </p>
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              status.tone === "due" && "bg-(--accent-soft) text-(--accent)",
              status.tone === "clear" && "bg-(--surface-3) text-(--text-2)",
              status.tone === "neutral" && "bg-(--surface-3) text-(--text-3)",
            )}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-1 text-lg font-semibold text-(--text-1) tabular-nums">
          {money(result.net, lang)}
        </p>
        {result.nisabValue !== null ? (
          <p className="mt-1 text-xs text-(--text-3)">
            {text(
              lang,
              `নিসাব (${result.basis === "gold" ? "সাড়ে ৭ ভরি সোনা" : "সাড়ে ৫২ ভরি রুপা"}): ${money(result.nisabValue, lang)}`,
              `Nisab (${result.basis === "gold" ? "7.5 tola gold" : "52.5 tola silver"}): ${money(result.nisabValue, lang)}`,
            )}
          </p>
        ) : null}
        <div className="mt-3 border-t border-(--border) pt-3">
          <p className="text-xs text-(--text-3)">
            {text(lang, "প্রদেয় যাকাত (২.৫%)", "Zakat due (2.5%)")}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-(--accent) tabular-nums">
            {money(result.due, lang)}
          </p>
        </div>
      </div>
    </div>
  );
}
