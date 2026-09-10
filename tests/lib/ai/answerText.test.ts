import { describe, expect, it } from "vitest";
import { stripTrailingSources } from "@/lib/ai/answerText";

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
