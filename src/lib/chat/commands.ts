import { CHAT_COMMANDS } from "@/config/site";

export type ChatCommand = (typeof CHAT_COMMANDS)[number]["command"];

export function matchCommand(text: string): ChatCommand | null {
  const typed = text.trim().toLowerCase();
  return CHAT_COMMANDS.find((entry) => entry.command === typed)?.command ?? null;
}

export function commandSuggestions(text: string): (typeof CHAT_COMMANDS)[number][] {
  if (!text.startsWith("/")) return [];
  const typed = text.trim().toLowerCase();
  return CHAT_COMMANDS.filter((entry) => entry.command.startsWith(typed));
}
