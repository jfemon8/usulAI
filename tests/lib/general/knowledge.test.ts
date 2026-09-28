import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays, hijriCalendarDate, nextHijriDate } from "@/lib/general/calendar";
import { answerGeneralQuestion, type GeneralAnswer } from "@/lib/general/compose";
import { detectGeneral, normalizeUtterance } from "@/lib/general/intents";
import { currentWaqt, durationLabel } from "@/lib/general/seasonal";
import { citedReferences, resolveCitations } from "@/lib/general/section";
import {
  computeZakat,
  emptyAssets,
  parseZakatAssets,
  SILVER_NISAB_GRAMS,
  VORI_GRAMS,
} from "@/lib/general/zakatMath";

const TIMINGS = {
  fajr: "04:34",
  sunrise: "05:49",
  dhuhr: "11:49",
  asr: "16:09",
  maghrib: "17:49",
  isha: "19:04",
};

function intentsOf(question: string) {
  return detectGeneral(question)?.clauses.map((clause) => clause.intent) ?? null;
}

function cardsOf(answer: GeneralAnswer | null) {
  return (answer?.info.blocks ?? []).flatMap((block) =>
    block.type === "card" ? [block.card] : [],
  );
}

function stubNetwork() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      const url = String(input);
      const body = url.includes("XAU")
        ? { price: 3110.35 }
        : url.includes("XAG")
          ? { price: 31.1 }
          : url.includes("er-api")
            ? { rates: { BDT: 120 } }
            : {
                data: {
                  timings: {
                    Fajr: "04:34",
                    Sunrise: "05:49",
                    Dhuhr: "11:49",
                    Asr: "16:09",
                    Maghrib: "17:49",
                    Isha: "19:04",
                  },
                },
              };
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("knowledge intents", () => {
  it.each([
    ["5 kalima", "kalima"],
    ["৫ কালিমা অর্থসহ", "kalima"],
    ["kalimar meaning", "kalima"],
    ["kalimar fazilat", "kalima"],
    ["namaj er gurutto", "salahImportance"],
    ["নামাজের ফজিলত", "salahFazilat"],
    ["kon namaj koto rakat", "rakat"],
    ["fojorer namaj koto rakat", "rakat"],
    ["বিতর নামাজ কত রাকাত", "rakat"],
    ["currently kon namajer oyakto", "currentPrayer"],
    ["next wakto koto", "currentPrayer"],
    ["এখন কোন নামাজের ওয়াক্ত চলছে?", "currentPrayer"],
    ["roja koto din por", "ramadan"],
    ["aj koto romjan", "ramadan"],
    ["রমজান কবে?", "ramadan"],
    ["aj iftar kokhon", "prayer"],
    ["seherir last time kokhon", "prayer"],
    ["rojar niyat", "sawmNiyat"],
    ["ইফতারের দোয়া", "iftarDua"],
    ["iftarer niyat", "iftarDua"],
    ["rojar fazilat", "sawmFazilat"],
    ["next hazz kobe", "hajj"],
    ["aj hozzer kon and koto tomo din", "hajj"],
    ["hazz er interesting fazilat", "hajjFazilat"],
    ["jakater nishab", "zakatNisab"],
    ["jakater poriman ba percentage", "zakatRate"],
    ["Jakater hisabe", "zakatCalc"],
    ["zakat calculator", "zakatCalc"],
    ["যাকাতের ফজিলত", "zakatFazilat"],
  ])("recognises %s", (question, intent) => {
    expect(intentsOf(question)?.[0]).toBe(intent);
  });

  it("answers several related questions from one message", () => {
    expect(intentsOf("roja and iftarer niyat")).toEqual(["sawmNiyat", "iftarDua"]);
    expect(intentsOf("namaj er gurutto o fazilat")).toEqual(["salahImportance", "salahFazilat"]);
    const kalima = detectGeneral("5 kalima, kalimar meaning, fazilat");
    expect(kalima?.clauses).toHaveLength(1);
    expect(kalima?.clauses[0]?.flags).toEqual(expect.arrayContaining(["meaning", "fazilat"]));
    expect(intentsOf("Namaj er gurutto, fazilat, time")).toEqual([
      "salahImportance",
      "salahFazilat",
      "prayer",
    ]);
  });

  it("reads which kalima, prayer or flag was asked", () => {
    expect(detectGeneral("কালিমা তামজীদ")?.clauses[0]?.variant).toBe("4");
    expect(detectGeneral("tritiyo kalima")?.clauses[0]?.variant).toBe("3");
    expect(detectGeneral("kalimar fazilat")?.clauses[0]?.flags).toContain("fazilat");
    expect(detectGeneral("fojorer namaj koto rakat")?.clauses[0]?.variant).toBe("fajr");
    expect(detectGeneral("বিতর নামাজ কত রাকাত")?.clauses[0]?.variant).toBe("witr");
    expect(detectGeneral("aj hozzer kon and koto tomo din")?.clauses[0]?.flags).toContain("today");
  });

  it.each([
    "নামাজের সময় কথা বলা যাবে?",
    "রোজা রাখা অবস্থায় টুথপেস্ট ব্যবহার করা যাবে?",
    "জাকাত কাকে দেওয়া যাবে?",
    "হজ কার উপর ফরজ?",
    "kalima porle ki oju lagbe",
    "namaz er rakat bhule gele ki korbo",
    "রোজা কত প্রকার?",
  ])("leaves %s to the evidence pipeline", (question) => {
    expect(detectGeneral(question)).toBeNull();
  });
});

describe("zakat", () => {
  it("keeps grouped and decimal numbers intact", () => {
    expect(normalizeUtterance("5,00,000 taka and 2.5 vori")).toBe("500000 taka and 2.5 vori");
    expect(normalizeUtterance("৫,০০,০০০ টাকা।")).toBe("৫০০০০০ টাকা");
  });

  it("reads assets from a sentence", () => {
    const clause = detectGeneral(
      "amar 5 lakh taka, 10 vori sona ache, 1 lakh taka rin, jakat koto dite hobe?",
    )?.clauses[0];
    expect(clause?.intent).toBe("zakatCalc");
    expect(clause?.assets).toMatchObject({ cash: 500000, debts: 100000 });
    expect(clause?.assets?.goldGrams).toBeCloseTo(10 * VORI_GRAMS);

    const bangla = parseZakatAssets(
      normalizeUtterance("আমার ২২ ক্যারেট ৫ ভরি সোনা, ২০ ভরি রুপা ও ব্যবসার পণ্য ২ লাখ টাকা").split(
        " ",
      ),
    );
    expect(bangla.assets).toMatchObject({ goldKarat: 22, business: 200000 });
    expect(bangla.assets.goldGrams).toBeCloseTo(5 * VORI_GRAMS);
    expect(bangla.assets.silverGrams).toBeCloseTo(20 * VORI_GRAMS);
  });

  it("uses the silver nisab for mixed wealth and 2.5% of the net", () => {
    const prices = { goldPerGram: 12000, silverPerGram: 150, source: null, updatedAt: null };
    const result = computeZakat(
      { ...emptyAssets(), cash: 500000, goldGrams: 10 * VORI_GRAMS, goldKarat: 22, debts: 100000 },
      prices,
    );
    const gold = 10 * VORI_GRAMS * 12000 * (22 / 24);
    expect(result.basis).toBe("silver");
    expect(result.nisabValue).toBeCloseTo(SILVER_NISAB_GRAMS * 150);
    expect(result.meetsNisab).toBe(true);
    expect(result.due).toBeCloseTo((500000 + gold - 100000) * 0.025);
  });

  it("uses the gold nisab for gold alone", () => {
    const prices = { goldPerGram: 12000, silverPerGram: 150, source: null, updatedAt: null };
    const below = computeZakat(
      { ...emptyAssets(), goldGrams: 5 * VORI_GRAMS, goldKarat: 24 },
      prices,
    );
    expect(below.basis).toBe("gold");
    expect(below.meetsNisab).toBe(false);
    expect(below.due).toBe(0);
  });

  it("computes the zakat in the answer and offers the calculator", async () => {
    stubNetwork();
    const answer = await answerGeneralQuestion("amar 10 lakh taka ache, jakat koto hobe", {
      now: new Date("2026-09-28T09:00:00Z"),
    });
    expect(answer?.text).toContain("প্রদেয় যাকাত (২.৫%): ৳২৫,০০০");
    expect(cardsOf(answer)[0]?.kind).toBe("zakat");
    expect(answer?.evidence).toContain("সুনানে আবু দাউদ 1573");
  });
});

describe("prayer now", () => {
  it.each([
    [200, "isha", "fajr"],
    [300, "fajr", "dhuhr"],
    [480, null, "dhuhr"],
    [900, "dhuhr", "asr"],
    [1000, "asr", "maghrib"],
    [1080, "maghrib", "isha"],
    [1300, "isha", "fajr"],
  ])("at minute %i the waqt is %s and next is %s", (minute, current, next) => {
    const waqt = currentWaqt(TIMINGS, minute);
    expect(waqt.key).toBe(current);
    expect(waqt.next).toBe(next);
  });

  it("says how long until the next prayer", () => {
    expect(durationLabel(100, "bn")).toBe("১ ঘণ্টা ৪০ মিনিট");
    expect(durationLabel(45, "en")).toBe("45 min");
  });

  it("answers with the running waqt and a live countdown", async () => {
    stubNetwork();
    const now = new Date("2026-09-28T10:40:00Z");
    const answer = await answerGeneralQuestion("currently kon namajer oyakto", { now });
    expect(answer?.text).toContain("এখন **আসরের** ওয়াক্ত চলছে");
    expect(answer?.text).toContain("পরবর্তী ওয়াক্ত **মাগরিব**");
    const card = cardsOf(answer)[0];
    expect(card?.kind).toBe("prayerNow");
    expect(card?.countdown?.to).toBe(now.getTime() + 69 * 60_000);
  });
});

describe("ramadan and hajj", () => {
  it("counts down to Ramadan outside it", async () => {
    const answer = await answerGeneralQuestion("roja koto din por", {
      now: new Date("2026-09-28T09:00:00Z"),
    });
    const start = nextHijriDate({ year: 2026, month: 9, day: 28 }, 9, 1);
    expect(start).not.toBeNull();
    expect(answer?.text).toContain("রমজান শুরু হতে আর প্রায়");
    expect(cardsOf(answer)[0]?.kind).toBe("ramadan");
  });

  it("tells the day of Ramadan during it", async () => {
    const start = nextHijriDate({ year: 2026, month: 9, day: 28 }, 9, 1)!;
    const day = addDays(start.date, 11);
    const answer = await answerGeneralQuestion("aj koto romjan", {
      now: new Date(Date.UTC(day.year, day.month - 1, day.day, 6)),
    });
    expect(answer?.text).toContain("আজ **১২ রমজান**");
  });

  it("names the day of Hajj during it and counts down otherwise", async () => {
    const start = nextHijriDate({ year: 2026, month: 9, day: 28 }, 12, 8)!;
    const arafah = addDays(start.date, 1);
    expect(hijriCalendarDate(arafah)?.day).toBe(9);
    const during = await answerGeneralQuestion("aj hozzer kon and koto tomo din", {
      now: new Date(Date.UTC(arafah.year, arafah.month - 1, arafah.day, 6)),
    });
    expect(during?.text).toContain("হজের **দ্বিতীয় দিন**");
    expect(during?.evidence).toContain("সহীহ মুসলিম 3288");

    const before = await answerGeneralQuestion("next hazz kobe", {
      now: new Date("2026-09-28T09:00:00Z"),
    });
    expect(before?.text).toContain("পরবর্তী হজ শুরু হবে প্রায়");
  });
});

describe("curated answers carry their evidence", () => {
  it("cites verified references and resolves them to numbers", async () => {
    const answer = await answerGeneralQuestion("namaj er gurutto o fazilat");
    expect(answer?.evidence).toEqual(
      expect.arrayContaining(["সহীহ বুখারী 528", "জামে তিরমিযী 413", "সহীহ মুসলিম 246"]),
    );
    const indexOf = new Map(answer!.evidence.map((reference, index) => [reference, index + 1]));
    const text = resolveCitations(answer!.text, indexOf);
    expect(citedReferences(text)).toEqual([]);
    expect(text).toMatch(/মুছে দেন \[\d+\]।/);
  });

  it("drops a citation the corpus could not supply", () => {
    expect(resolveCitations("ফরজ⟦সহীহ বুখারী 8⟧।", new Map())).toBe("ফরজ।");
  });

  it("gives all five kalimas with Arabic, pronunciation and meaning", async () => {
    const answer = await answerGeneralQuestion("5 kalima");
    for (const name of ["তাইয়্যেবা", "শাহাদাত", "তাওহীদ", "তামজীদ", "রদ্দে কুফর"]) {
      expect(answer?.text).toContain(name);
    }
    expect(answer?.text).toContain("لَا إِلٰهَ إِلَّا اللّٰهُ");
    expect(answer?.text).toContain("**উচ্চারণ:** লা ইলাহা ইল্লাল্লাহু মুহাম্মাদুর রাসূলুল্লাহ");
  });

  it("marks the weak iftar dua as weak", async () => {
    const answer = await answerGeneralQuestion("iftar er dua");
    expect(answer?.text).toContain("দুর্বল");
    expect(answer?.evidence).toEqual([
      "সহীহ বুখারী 1957",
      "সুনানে আবু দাউদ 2357",
      "সুনানে আবু দাউদ 2358",
    ]);
  });
});
