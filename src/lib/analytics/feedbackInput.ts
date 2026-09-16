import { z } from "zod";
import { FEEDBACK_SUBMIT_CONFIG, SOURCE_PRIORITY } from "@/config/site";

function clamped(keep: number) {
  return z
    .string()
    .max(FEEDBACK_SUBMIT_CONFIG.maxBodyChars)
    .transform((value) => value.trim().slice(0, keep));
}

export const feedbackSubmitInput = z.object({
  verdict: z.enum(["helpful", "unhelpful", "wrong-citation"]),
  question: clamped(FEEDBACK_SUBMIT_CONFIG.questionChars).refine(
    (value) => value.length > 0,
    "প্রশ্ন খালি রাখা যাবে না",
  ),
  answer: clamped(FEEDBACK_SUBMIT_CONFIG.answerChars).refine(
    (value) => value.length > 0,
    "উত্তর খালি রাখা যাবে না",
  ),
  note: clamped(FEEDBACK_SUBMIT_CONFIG.noteChars).optional(),
  sources: z
    .array(
      z.object({
        index: z.number().int().min(0).max(999),
        sourceType: z.enum(SOURCE_PRIORITY),
        reference: z.string().max(FEEDBACK_SUBMIT_CONFIG.referenceChars),
      }),
    )
    .max(FEEDBACK_SUBMIT_CONFIG.maxSources)
    .default([]),
});

export type FeedbackSubmitInput = z.infer<typeof feedbackSubmitInput>;
