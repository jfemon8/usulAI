export const GENERIC_CHAT_ERROR =
  "দুঃখিত, এই মুহূর্তে উত্তর পাঠানো গেল না। একটু পরে আবার চেষ্টা করুন।";

export function readableChatError(error: Error | undefined): string | null {
  if (!error) return null;

  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    return typeof parsed.error === "string" && parsed.error.length > 0
      ? parsed.error
      : GENERIC_CHAT_ERROR;
  } catch {
    return GENERIC_CHAT_ERROR;
  }
}
