import { SELF_LEARNING_CONFIG } from "@/config/site";
import { recordFeedback } from "@/lib/analytics/feedback";
import { recordRankingFeedback } from "@/lib/analytics/rankingSignals";
import { composeNukta } from "@/lib/utils/bangla";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource, UsulUIMessage } from "@/types";

export type FollowUpSignal = "complaint" | "thanks" | null;

const COMPLAINT = new RegExp(
  [
    "ভুল",
    "সঠিক নয়",
    "সঠিক না",
    "ঠিক নয়",
    "ঠিক না",
    "ভুয়া",
    "মিথ্যা",
    "বানোয়াট",
    "অপ্রাসঙ্গিক",
    "প্রাসঙ্গিক নয়",
    "প্রাসঙ্গিক না",
    "vul",
    "bhul",
    "thik na",
    "thik noy",
    "sothik na",
    "shothik na",
    "sothik noy",
    "wrong",
    "incorrect",
    "not correct",
    "irrelevant",
    "not relevant",
    "fabricated",
    "made up",
  ]
    .map((term) => composeNukta(term))
    .join("|"),
  "iu",
);

const ABOUT_THE_ANSWER = new RegExp(
  [
    "উত্তর",
    "জবাব",
    "দলিল",
    "রেফারেন্স",
    "সূত্র",
    "হাদিস",
    "হাদীস",
    "আয়াত",
    "তথ্য",
    "আপনি",
    "আপনার",
    "তুমি",
    "তোমার",
    "দিয়েছ",
    "দিয়েছেন",
    "দিলেন",
    "দিলা",
    "বললেন",
    "বলছেন",
    "বলেছ",
    "এটা",
    "এটি",
    "uttor",
    "answer",
    "reference",
    "dolil",
    "hadis",
    "ayat",
    "tumi",
    "apni",
    "dila",
    "dilen",
    "bolla",
    "bolcho",
    "you",
    "your",
    "this",
    "that",
    "response",
  ]
    .map((term) => composeNukta(term))
    .join("|"),
  "iu",
);

const CONDITIONAL = new RegExp(
  ["হলে", "করলে", "হয়ে গেলে", "যদি", "hole", "korle", "jodi", "if", "when"]
    .map((term) => composeNukta(term))
    .join("|"),
  "iu",
);

const THANKS = new RegExp(
  [
    "ধন্যবাদ",
    "জাযাকাল্লাহ",
    "জাজাকাল্লাহ",
    "বুঝেছি",
    "বুঝলাম",
    "উপকৃত",
    "jazakallah",
    "jazak allah",
    "thanks",
    "thank you",
    "bujhlam",
    "bujhechi",
    "got it",
    "helpful",
  ]
    .map((term) => composeNukta(term))
    .join("|"),
  "iu",
);

const THANKS_MAX_WORDS = 10;

function nearAnswerWord(text: string, index: number): boolean {
  const window = SELF_LEARNING_CONFIG.complaintWindowChars;
  return ABOUT_THE_ANSWER.test(text.slice(Math.max(0, index - window), index + window * 2));
}

export function classifyFollowUp(message: string): FollowUpSignal {
  const text = composeNukta(message).toLowerCase().trim();
  if (text.length === 0) return null;
  const words = text.split(/\s+/).length;

  const complaint = COMPLAINT.exec(text);
  if (complaint) {
    const short = words <= SELF_LEARNING_CONFIG.complaintMaxWords && !CONDITIONAL.test(text);
    if (short || nearAnswerWord(text, complaint.index)) return "complaint";
  }

  return words <= THANKS_MAX_WORDS && THANKS.test(text) ? "thanks" : null;
}

function messageText(message: UsulUIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function messageSources(message: UsulUIMessage): AnswerSource[] {
  return message.parts.flatMap((part) => {
    if (part.type !== "data-sources" || !Array.isArray(part.data)) return [];
    return (part.data as unknown[]).filter(
      (source): source is AnswerSource =>
        typeof source === "object" &&
        source !== null &&
        typeof (source as { reference?: unknown }).reference === "string",
    );
  });
}

export interface PreviousExchange {
  question: string;
  answer: string;
  sources: AnswerSource[];
  followUp: string;
}

export function previousExchange(messages: UsulUIMessage[]): PreviousExchange | null {
  const roles = messages.map((message) => message.role);
  const followUpIndex = roles.lastIndexOf("user");
  if (followUpIndex <= 0) return null;

  const assistantIndex = roles.slice(0, followUpIndex).lastIndexOf("assistant");
  if (assistantIndex <= 0) return null;

  const questionIndex = roles.slice(0, assistantIndex).lastIndexOf("user");
  if (questionIndex < 0) return null;

  const question = messageText(messages[questionIndex]!).trim();
  const answer = messageText(messages[assistantIndex]!).trim();
  if (!question || !answer) return null;

  return {
    question,
    answer,
    sources: messageSources(messages[assistantIndex]!),
    followUp: messageText(messages[followUpIndex]!),
  };
}

export async function learnFromFollowUp(
  messages: UsulUIMessage[],
  clientKey?: string,
): Promise<FollowUpSignal> {
  if (!SELF_LEARNING_CONFIG.enabled) return null;

  const exchange = previousExchange(messages);
  if (!exchange) return null;

  const signal = classifyFollowUp(exchange.followUp);
  if (!signal) return null;

  try {
    if (signal === "complaint") {
      await recordFeedback({
        verdict: "unhelpful",
        question: exchange.question.slice(0, 2000),
        answer: exchange.answer.slice(0, 8000),
        sources: exchange.sources,
        note: exchange.followUp.slice(0, 2000),
        origin: "implicit",
        ...(clientKey ? { clientKey } : {}),
      });
    } else {
      await recordRankingFeedback(exchange.question, exchange.sources, true, true);
    }
    logger.info("Learned from a follow-up message", {
      signal,
      question: exchange.question.slice(0, 80),
    });
  } catch (error) {
    logger.warn("Implicit feedback failed", { error: String(error).slice(0, 160) });
  }

  return signal;
}
