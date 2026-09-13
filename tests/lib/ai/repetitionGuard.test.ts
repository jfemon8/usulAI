import { describe, expect, it } from "vitest";
import { createRepetitionGuard } from "@/lib/ai/repetitionGuard";

function streamWords(text: string, context = "") {
  const guard = createRepetitionGuard(context);
  const pieces = text.match(/\S+\s*/g) ?? [];
  let output = "";
  let stoppedAfter: number | null = null;

  for (const [index, piece] of pieces.entries()) {
    const step = guard.push(piece);
    output += step.emit;
    if (step.stopped) {
      stoppedAfter = index;
      break;
    }
  }

  output += guard.flush();
  return { output, cut: guard.wasCut(), stoppedAfter };
}

const healthy =
  "প্রতিবেশীর হক ইসলামে অত্যন্ত গুরুত্বপূর্ণ। জিবরীল (আঃ) অবিরত নবীজিকে প্রতিবেশীর হক সম্বন্ধে উপদেশ দিতেন [1]। এমনকি নবীজির ধারণা হয়েছিল যে প্রতিবেশীকে উত্তরাধিকারী বানিয়ে দেওয়া হবে [2]।";

const looping = `${healthy} তার দিক প্রতিবেশী। [1]

হাদিসের অর্থ হলো, এর অর্থ হলো, এর অর্থ হলো, এর অর্থ হলো, এর অর্থ হলো, এর অর্থ হলো, এর অর্থ হলো।`;

describe("createRepetitionGuard", () => {
  it("passes a healthy answer through unchanged", () => {
    const { output, cut } = streamWords(healthy);

    expect(output).toBe(healthy);
    expect(cut).toBe(false);
  });

  it("cuts the loop from the screenshot before it reaches the reader", () => {
    const { output, cut } = streamWords(looping);

    expect(cut).toBe(true);
    expect(output).not.toContain("এর অর্থ হলো, এর অর্থ হলো");
    expect(output).toContain("উত্তরাধিকারী বানিয়ে দেওয়া হবে [2]।");
  });

  it("drops the broken sentence whole rather than leaving a dangling fragment", () => {
    const { output } = streamWords(looping);

    expect(output).not.toContain("হাদিসের অর্থ হলো");
    expect(output.trimEnd().endsWith("[1]")).toBe(true);
  });

  it("stops consuming the model stream as soon as the loop is certain", () => {
    const { stoppedAfter } = streamWords(looping);
    const totalWords = (looping.match(/\S+\s*/g) ?? []).length;

    expect(stoppedAfter).not.toBeNull();
    expect(stoppedAfter!).toBeLessThan(totalWords - 1);
  });

  it("keeps a repetition that is genuinely quoted from the sources", () => {
    const adhan = "আল্লাহু আকবার, আল্লাহু আকবার, আল্লাহু আকবার, আল্লাহু আকবার।";
    const answer = `আজানের শুরুতে বলা হয়: ${adhan} [1]`;

    const { output, cut } = streamWords(answer, `বাংলা: ${adhan}`);

    expect(cut).toBe(false);
    expect(output).toBe(answer);
  });

  it("still cuts the same repetition when the sources do not contain it", () => {
    const answer =
      "উত্তর হলো: আল্লাহু আকবার, আল্লাহু আকবার, আল্লাহু আকবার, আল্লাহু আকবার, আল্লাহু আকবার।";

    expect(streamWords(answer).cut).toBe(true);
  });

  it("streams progressively instead of holding the whole answer back", () => {
    const guard = createRepetitionGuard("");
    const words = Array.from({ length: 120 }, (_, index) => `শব্দ${index} `);
    let emittedBeforeFlush = "";

    for (const word of words) emittedBeforeFlush += guard.push(word).emit;

    expect(emittedBeforeFlush.length).toBeGreaterThan(0);
    expect(emittedBeforeFlush + guard.flush()).toBe(words.join(""));
  });
});
