import { describe, expect, it } from "vitest";
import { detectGeneral } from "@/lib/general/intents";

function intentsOf(question: string) {
  return detectGeneral(question)?.clauses.map((clause) => clause.intent) ?? null;
}

describe("detectGeneral", () => {
  it.each([
    ["আসসালামু আলাইকুম", "salam"],
    ["আসসালামুয়ালাইকুম ওয়া রাহমাতুল্লাহ", "salam"],
    ["Assalamualaikum", "salam"],
    ["assalamu alaikum wa rahmatullahi wa barakatuh", "salam"],
    ["Aslamualaikum", "salam"],
    ["السلام عليكم", "salam"],
    ["ওয়া আলাইকুমুস সালাম", "salamReply"],
    ["walaikum assalam", "salamReply"],
    ["hello!", "greeting"],
    ["Good morning", "greeting"],
    ["কেমন আছেন?", "wellbeing"],
    ["kemon acho", "wellbeing"],
    ["how are you?", "wellbeing"],
    ["তুমি কে?", "identity"],
    ["tumi ke", "identity"],
    ["Who are you?", "identity"],
    ["what is your name", "identity"],
    ["তোমার নাম কী", "identity"],
    ["তুমি কী কী করতে পারো?", "capabilities"],
    ["what can you do", "capabilities"],
    ["তোমাকে কে বানিয়েছে?", "creator"],
    ["তোমাকে কে তৈরি করেছে", "creator"],
    ["tomake k baniyeche?", "creator"],
    ["tomake ke banaise", "creator"],
    ["Who made you?", "creator"],
    ["who is your developer", "creator"],
    ["ধন্যবাদ", "thanks"],
    ["জাযাকাল্লাহু খাইরান", "thanks"],
    ["thank you so much", "thanks"],
    ["আল্লাহ হাফেজ", "goodbye"],
    ["bye", "goodbye"],
    ["আজ কত তারিখ?", "date"],
    ["ajke koto tarikh", "date"],
    ["what is the date today", "date"],
    ["আজ হিজরি কত তারিখ", "date"],
    ["আজ কী বার?", "day"],
    ["ajke ki bar", "day"],
    ["what day is it today?", "day"],
    ["এখন কয়টা বাজে?", "time"],
    ["koyta baje", "time"],
    ["what time is it", "time"],
    ["ঢাকার আবহাওয়া কেমন?", "weather"],
    ["ajker abohawa kemon", "weather"],
    ["weather in London", "weather"],
    ["আজ কি বৃষ্টি হবে?", "weather"],
    ["আজকের নামাজের সময়সূচি", "prayer"],
    ["ajker namazer somoy", "prayer"],
    ["iftar kokhon", "prayer"],
    ["prayer times today", "prayer"],
  ])("recognises %s", (question, intent) => {
    expect(intentsOf(question)).toEqual([intent]);
  });

  it("answers a greeting together with a question in the same message", () => {
    expect(intentsOf("Assalamu alaikum, tumi ke?")).toEqual(["salam", "identity"]);
    expect(intentsOf("assalamualaikum tomake ke baniyeche")).toEqual(["salam", "creator"]);
    expect(intentsOf("হ্যালো, আজ কত তারিখ?")).toEqual(["greeting", "date"]);
  });

  it.each([
    "সালামের উত্তর কীভাবে দিতে হয়?",
    "salam er uttor dewa ki wajib",
    "নামাজের সময় কথা বলা যাবে?",
    "বৃষ্টির পানিতে ওযু করা যাবে?",
    "যাকাত কাদের উপর ফরজ?",
    "ajke roja rakha jabe?",
    "Assalamu alaikum, namaz er foroj koyti?",
    "what does islam say about time",
    "তুমি কে বলো তো কুরআনে কী আছে",
    "namaz",
  ])("leaves %s to the evidence pipeline", (question) => {
    expect(detectGeneral(question)).toBeNull();
  });

  it("answers Bangla and Banglish in Bangla and English in English", () => {
    expect(detectGeneral("tumi ke")?.lang).toBe("bn");
    expect(detectGeneral("তুমি কে")?.lang).toBe("bn");
    expect(detectGeneral("ajke koto tarikh")?.lang).toBe("bn");
    expect(detectGeneral("who are you")?.lang).toBe("en");
    expect(detectGeneral("who are you", true)?.lang).toBe("bn");
  });

  it("keeps the place, flags and prayer a question asks about", () => {
    expect(detectGeneral("dhakar abohawa kemon")?.clauses[0]?.placeWords).toEqual(["dhakar"]);
    expect(detectGeneral("আগামীকাল চট্টগ্রামের আবহাওয়া")?.clauses[0]?.flags).toContain("tomorrow");
    expect(detectGeneral("আজ হিজরি কত তারিখ")?.clauses[0]?.flags).toContain("hijri");
    expect(detectGeneral("আজ ফজরের সময় কখন")?.clauses[0]?.prayer).toBe("fajr");
    expect(detectGeneral("sehri kokhon shesh")?.clauses[0]?.prayer).toBe("sehri");
  });
});
