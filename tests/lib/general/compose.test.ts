import { afterEach, describe, expect, it, vi } from "vitest";
import { answerGeneralQuestion, type GeneralAnswer } from "@/lib/general/compose";

function cardsOf(answer: GeneralAnswer | null) {
  return (answer?.info.blocks ?? []).flatMap((block) =>
    block.type === "card" ? [block.card] : [],
  );
}

function leadOf(answer: GeneralAnswer | null) {
  return (answer?.info.blocks ?? [])
    .flatMap((block) => (block.type === "markdown" ? [block.text] : []))
    .join("\n\n");
}

const NOW = new Date("2026-09-28T14:15:00Z");

function mockFetch(handler: (url: URL) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      const body = handler(new URL(String(input)));
      return new Response(JSON.stringify(body), { status: body === null ? 500 : 200 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("answerGeneralQuestion", () => {
  it("names the creator with a link that opens the website", async () => {
    const answer = await answerGeneralQuestion("tomake k baniyeche?", { now: NOW });
    expect(answer?.text).toContain("[Emon](https://jfemon.vercel.app/)");
    expect(cardsOf(answer)[0]).toMatchObject({
      kind: "creator",
      headline: "Emon",
      headlineHref: "https://jfemon.vercel.app/",
    });
  });

  it("introduces itself in English for an English question", async () => {
    const answer = await answerGeneralQuestion("who are you?", { now: NOW });
    expect(answer?.text).toContain("I'm **Usul AI**");
    expect(answer?.text).toContain("[Emon](https://jfemon.vercel.app/)");
    expect(cardsOf(answer)).toEqual([]);
  });

  it("returns the salam first and the Arabic reply verbatim", async () => {
    const answer = await answerGeneralQuestion("আসসালামু আলাইকুম, আজ কত তারিখ?", { now: NOW });
    expect(answer?.text.startsWith("وَعَلَيْكُمُ السَّلَامُ")).toBe(true);
    expect(leadOf(answer)).toContain("ওয়া আলাইকুমুস সালাম");
    expect(answer?.text).toContain("আজ **সোমবার**, ২৮ সেপ্টেম্বর ২০২৬ খ্রিস্টাব্দ");
    expect(answer?.text).toContain("১৩ আশ্বিন ১৪৩৩ বঙ্গাব্দ");
    expect(answer?.text).toContain("১৭ রবিউস সানি ১৪৪৮ হিজরি");
  });

  it("tells the time in the reader's own time zone", async () => {
    const answer = await answerGeneralQuestion("what time is it", {
      now: NOW,
      timeZone: "Europe/London",
    });
    expect(answer?.text).toContain("**3:15 PM**");
    expect(cardsOf(answer)[0]).toMatchObject({ kind: "time", timeZone: "Europe/London" });
  });

  it("reports the weather for a named city", async () => {
    mockFetch((url) => {
      expect(url.searchParams.get("latitude")).toBe("22.3569");
      return {
        current: {
          time: "2026-09-28T20:15",
          temperature_2m: 30.6,
          apparent_temperature: 36.9,
          relative_humidity_2m: 71,
          weather_code: 63,
          wind_speed_10m: 12.4,
          is_day: 0,
        },
        daily: {
          time: ["2026-09-28", "2026-09-29"],
          weather_code: [63, 2],
          temperature_2m_max: [34.9, 33],
          temperature_2m_min: [28.4, 27],
          precipitation_probability_max: [71, 20],
          sunrise: ["2026-09-28T05:45", "2026-09-29T05:46"],
          sunset: ["2026-09-28T17:44", "2026-09-29T17:43"],
          uv_index_max: [7, 6],
        },
      };
    });
    const answer = await answerGeneralQuestion("chittagong er abohawa kemon", { now: NOW });
    expect(answer?.text).toContain("**চট্টগ্রাম**");
    expect(cardsOf(answer)[0]).toMatchObject({ kind: "weather", headline: "৩১°সে" });
  });

  it("lists prayer times and marks the next prayer", async () => {
    mockFetch(() => ({
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
    }));
    const answer = await answerGeneralQuestion("ajker namazer somoy", {
      now: new Date("2026-09-28T09:00:00Z"),
    });
    expect(answer?.text).toContain("| ফজর | ভোর ৪:৩৪ |");
    expect(answer?.text).toContain("| মাগরিব | সন্ধ্যা ৫:৪৯ |");
    expect(answer?.text).toContain("পরবর্তী ওয়াক্ত: **আসর**");
  });

  it("points to tomorrow's Fajr once today's prayers are over", async () => {
    mockFetch((url) => ({
      data: {
        timings: {
          Fajr: url.pathname.endsWith("29-09-2026") ? "04:35" : "04:34",
          Sunrise: "05:49",
          Dhuhr: "11:49",
          Asr: "16:09",
          Maghrib: "17:49",
          Isha: "19:04",
        },
      },
    }));
    const answer = await answerGeneralQuestion("আজকের নামাজের সময়সূচি", {
      now: new Date("2026-09-28T15:00:00Z"),
    });
    expect(answer?.text).toContain("পরবর্তী ওয়াক্ত: **আগামীকাল ফজর**, ভোর ৪:৩৫");
    expect(cardsOf(answer)[0]).toMatchObject({ headline: "ভোর ৪:৩৫" });
  });

  it("apologises instead of failing when the weather service is down", async () => {
    mockFetch(() => null);
    const answer = await answerGeneralQuestion("dhakar abohawa", { now: NOW });
    expect(answer?.text).toContain("আনা যাচ্ছে না");
    expect(cardsOf(answer)).toEqual([]);
  });

  it("leaves real questions to the evidence pipeline", async () => {
    expect(await answerGeneralQuestion("যাকাত কাদের উপর ফরজ?", { now: NOW })).toBeNull();
  });
});
