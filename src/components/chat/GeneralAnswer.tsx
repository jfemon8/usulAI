"use client";

import { useSyncExternalStore } from "react";
import { clsx } from "clsx";
import { AnswerMarkdown } from "@/components/chat/AnswerMarkdown";
import { ZakatCalculator } from "@/components/chat/ZakatCalculator";
import { ExternalLinkIcon } from "@/components/ui/Icons";
import { bengaliDigits, dayPeriod } from "@/lib/general/calendar";
import type { GeneralCard, GeneralInfo } from "@/types";

function subscribeSeconds(onChange: () => void): () => void {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
}

function liveClock(timeZone: string, lang: GeneralCard["lang"]): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const hour = read("hour") % 24;
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    const clock = `${twelve}:${String(read("minute")).padStart(2, "0")}:${String(read("second")).padStart(2, "0")}`;
    return lang === "bn"
      ? `${dayPeriod(hour)} ${bengaliDigits(clock)}`
      : `${clock} ${hour < 12 ? "AM" : "PM"}`;
  } catch {
    return "";
  }
}

function LiveHeadline({ card }: { card: GeneralCard }) {
  const value = useSyncExternalStore(
    subscribeSeconds,
    () => (card.timeZone ? liveClock(card.timeZone, card.lang) : card.headline),
    () => card.headline,
  );
  return (
    <span aria-live="off" className="tabular-nums">
      {value || card.headline}
    </span>
  );
}

function countdownText(to: number, lang: GeneralCard["lang"]): string {
  const total = Math.max(0, Math.floor((to - Date.now()) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (lang === "bn") {
    const parts = [
      hours > 0 ? `${bengaliDigits(hours)} ঘণ্টা` : "",
      `${bengaliDigits(pad(minutes))} মিনিট`,
      `${bengaliDigits(pad(seconds))} সেকেন্ড`,
    ];
    return total === 0 ? "শুরু হয়ে গেছে" : parts.filter(Boolean).join(" ");
  }
  if (total === 0) return "Started";
  return `${hours > 0 ? `${hours}h ` : ""}${pad(minutes)}m ${pad(seconds)}s`;
}

function Countdown({ card }: { card: GeneralCard }) {
  const countdown = card.countdown;
  const value = useSyncExternalStore(
    subscribeSeconds,
    () => (countdown ? countdownText(countdown.to, card.lang) : ""),
    () => "",
  );
  if (!countdown) return null;
  return (
    <div className="relative mt-4 flex items-center justify-between gap-3 rounded-xl bg-(--accent-soft) px-3 py-2.5">
      <span className="text-xs font-medium text-(--text-2)">{countdown.label}</span>
      <span className="text-base font-semibold text-(--accent) tabular-nums" aria-live="off">
        {value}
      </span>
    </div>
  );
}

function CardHeadline({ card }: { card: GeneralCard }) {
  const className =
    "block text-3xl leading-tight font-semibold tracking-tight text-(--text-1) sm:text-4xl";

  if (card.headlineHref) {
    return (
      <a
        href={card.headlineHref}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          className,
          "group inline-flex items-center gap-2 text-(--accent) decoration-2 underline-offset-4 hover:underline",
        )}
      >
        {card.headline}
        <ExternalLinkIcon className="h-5 w-5 opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </a>
    );
  }

  return (
    <p className={clsx(className, "tabular-nums")}>
      {card.kind === "time" && card.timeZone ? <LiveHeadline card={card} /> : card.headline}
    </p>
  );
}

function CardIcon({ card }: { card: GeneralCard }) {
  if (card.kind === "creator") {
    return (
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent) text-lg font-semibold text-(--accent-contrast) shadow-sm"
      >
        {card.headline.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  if (!card.icon) return null;
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-2xl"
    >
      {card.icon}
    </span>
  );
}

function InfoCard({ card, index }: { card: GeneralCard; index: number }) {
  return (
    <section
      aria-label={[card.eyebrow, card.headline].filter(Boolean).join(" · ")}
      style={{ animationDelay: `${index * 70}ms` }}
      className="rise-in relative overflow-hidden rounded-2xl border border-(--border) bg-(--bg) p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-(--accent-soft) blur-2xl"
      />
      <div className="relative flex items-start gap-3.5">
        <CardIcon card={card} />
        <div className="min-w-0 flex-1">
          {card.eyebrow ? (
            <p className="truncate text-xs font-medium tracking-wide text-(--text-3) uppercase">
              {card.eyebrow}
            </p>
          ) : null}
          <div className="mt-0.5">
            <CardHeadline card={card} />
          </div>
          {card.subline ? (
            <p className="mt-1 text-sm leading-6 text-(--text-2)">{card.subline}</p>
          ) : null}
        </div>
      </div>

      {card.stats && card.stats.length > 0 ? (
        <dl className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {card.stats.map((stat) => (
            <div key={stat.label} className="min-w-0 rounded-xl bg-(--surface-2) px-3 py-2">
              <dt className="truncate text-xs text-(--text-3)">{stat.label}</dt>
              <dd className="mt-0.5 text-sm font-medium wrap-break-word text-(--text-1) tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <Countdown card={card} />

      {card.zakat ? (
        <ZakatCalculator lang={card.lang} prices={card.zakat.prices} assets={card.zakat.assets} />
      ) : null}

      {card.rows && card.rows.length > 0 ? (
        <ul className="relative mt-4 flex flex-col gap-1">
          {card.rows.map((row) => (
            <li
              key={row.label}
              className={clsx(
                "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm",
                row.highlight
                  ? "bg-(--accent-soft) font-semibold text-(--text-1)"
                  : "text-(--text-2)",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={clsx(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    row.highlight ? "bg-(--accent)" : "bg-(--border-strong)",
                  )}
                />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-end tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {card.link ? (
        <a
          href={card.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast) transition hover:bg-(--accent-strong)"
        >
          {card.link.label}
          <ExternalLinkIcon className="h-4 w-4" />
        </a>
      ) : null}

      {card.note ? (
        <p className="relative mt-3 text-xs leading-5 text-(--text-3)">{card.note}</p>
      ) : null}
    </section>
  );
}

export function GeneralAnswer({ info, streaming }: { info: GeneralInfo; streaming: boolean }) {
  let cardIndex = 0;
  return (
    <div className="flex flex-col gap-3">
      {info.blocks.map((block, index) =>
        block.type === "markdown" ? (
          <AnswerMarkdown key={`markdown-${index}`} text={block.text} streaming={streaming} />
        ) : (
          <InfoCard key={`${block.card.kind}-${index}`} card={block.card} index={cardIndex++} />
        ),
      )}
    </div>
  );
}
