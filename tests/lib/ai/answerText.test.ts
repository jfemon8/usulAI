import { describe, expect, it } from "vitest";
import { normalizeDashes, stripTrailingSources } from "@/lib/ai/answerText";

const body = "সুদ হারাম [1]। ব্যবসা হালাল [2]।";

describe("stripTrailingSources", () => {
  it("removes a bold Bangla source list", () => {
    const text = `${body}\n\n**সূত্র:**\n- [1] সূরা আল-বাকারা 2:275\n- [2] সহীহ বুখারী 2084`;
    expect(stripTrailingSources(text)).toBe(body);
  });

  it("removes a heading-style source list", () => {
    const text = `${body}\n\n### সূত্র\n1. সূরা আল-ইমরান ৩:১৩০ [3]\n2. সহীহ বুখারী ৭২৭৭ [5]`;
    expect(stripTrailingSources(text)).toBe(body);
  });

  it("removes an English sources list", () => {
    const text = `${body}\n\nSources:\n- [1] Al-Baqara 2:275`;
    expect(stripTrailingSources(text)).toBe(body);
  });

  it("removes a dangling heading with no list under it", () => {
    expect(stripTrailingSources(`${body}\n\n**সূত্র:**`)).toBe(body);
  });

  it("keeps inline citation markers untouched", () => {
    expect(stripTrailingSources(body)).toBe(body);
  });

  it("does not cut a body that merely mentions the word", () => {
    const text = "কথোপকথনের সূত্র ধরে বলছি, সুদ হারাম [1]।";
    expect(stripTrailingSources(text)).toBe(text);
  });
});

describe("normalizeDashes", () => {
  it("turns a spaced em-dash into a comma", () => {
    expect(normalizeDashes("সুদ হারাম — এটি কুরআনে স্পষ্ট।")).toBe("সুদ হারাম, এটি কুরআনে স্পষ্ট।");
  });

  it("keeps markdown list bullets as hyphens", () => {
    expect(normalizeDashes("তালিকা:\n— প্রথম\n— দ্বিতীয়")).toBe("তালিকা:\n- প্রথম\n- দ্বিতীয়");
  });

  it("tightens a dash used inside a compound", () => {
    expect(normalizeDashes("বাবা—মেয়ে")).toBe("বাবা-মেয়ে");
  });

  it("handles en-dashes the same way", () => {
    expect(normalizeDashes("ক – খ")).toBe("ক, খ");
  });

  it("leaves text without dashes alone", () => {
    expect(normalizeDashes("সুদ হারাম, এটি স্পষ্ট।")).toBe("সুদ হারাম, এটি স্পষ্ট।");
  });
});
