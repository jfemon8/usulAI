import { describe, expect, it } from "vitest";
import { FEEDBACK_SUBMIT_CONFIG, FEEDBACK_VOTE_CONFIG } from "@/config/site";
import { feedbackSubmitInput } from "@/lib/analytics/feedbackInput";

const base = {
  verdict: "helpful" as const,
  question: "নামাজের শর্ত কী কী?",
  answer: "নামাজের শর্ত সাতটি।",
  sources: [{ index: 1, sourceType: "quran" as const, reference: "Al-Baqara 2:3" }],
};

describe("feedback submissions", () => {
  it("accepts the long answers that used to be rejected with a 400", () => {
    const answer = "ক".repeat(FEEDBACK_VOTE_CONFIG.maxAnswerChars * 2);
    const parsed = feedbackSubmitInput.safeParse({ ...base, answer });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.answer.length).toBe(answer.length);
  });

  it("clamps an answer longer than it needs to keep", () => {
    const parsed = feedbackSubmitInput.safeParse({
      ...base,
      answer: "ক".repeat(FEEDBACK_SUBMIT_CONFIG.answerChars + 1_000),
    });

    expect(parsed.success && parsed.data.answer.length).toBe(FEEDBACK_SUBMIT_CONFIG.answerChars);
  });

  it("keeps enough of the answer to identify the response", () => {
    expect(FEEDBACK_SUBMIT_CONFIG.answerChars).toBeGreaterThanOrEqual(
      FEEDBACK_VOTE_CONFIG.maxAnswerChars,
    );
  });

  it("clamps a long question and note", () => {
    const parsed = feedbackSubmitInput.safeParse({
      ...base,
      question: "ক".repeat(FEEDBACK_SUBMIT_CONFIG.questionChars + 500),
      note: "খ".repeat(FEEDBACK_SUBMIT_CONFIG.noteChars + 500),
    });

    expect(parsed.success && parsed.data.question.length).toBe(
      FEEDBACK_SUBMIT_CONFIG.questionChars,
    );
    expect(parsed.success && parsed.data.note?.length).toBe(FEEDBACK_SUBMIT_CONFIG.noteChars);
  });

  it("still refuses an empty question or answer, a bad verdict and an oversized body", () => {
    expect(feedbackSubmitInput.safeParse({ ...base, answer: "   " }).success).toBe(false);
    expect(feedbackSubmitInput.safeParse({ ...base, question: "" }).success).toBe(false);
    expect(feedbackSubmitInput.safeParse({ ...base, verdict: "great" }).success).toBe(false);
    expect(
      feedbackSubmitInput.safeParse({
        ...base,
        answer: "ক".repeat(FEEDBACK_SUBMIT_CONFIG.maxBodyChars + 1),
      }).success,
    ).toBe(false);
  });

  it("defaults missing sources and refuses an unknown source type", () => {
    const parsed = feedbackSubmitInput.safeParse({ ...base, sources: undefined });
    expect(parsed.success && parsed.data.sources).toEqual([]);

    expect(
      feedbackSubmitInput.safeParse({
        ...base,
        sources: [{ index: 1, sourceType: "wikipedia", reference: "x" }],
      }).success,
    ).toBe(false);
  });
});
