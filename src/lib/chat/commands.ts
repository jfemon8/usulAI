import { CHAT_COMMANDS, type ChatCommandEntry } from "@/config/site";

export type ChatCommand = (typeof CHAT_COMMANDS)[number]["command"];

export function commandEntry(command: ChatCommand): ChatCommandEntry {
  return CHAT_COMMANDS.find((entry) => entry.command === command) as ChatCommandEntry;
}

export function matchCommand(text: string): ChatCommand | null {
  const typed = text.trim().toLowerCase();
  return CHAT_COMMANDS.find((entry) => entry.command === typed)?.command ?? null;
}

export function commandSuggestions(text: string): ChatCommandEntry[] {
  if (!text.startsWith("/")) return [];
  const typed = text.trim().toLowerCase();
  return (CHAT_COMMANDS as readonly ChatCommandEntry[]).filter(
    (entry) => !entry.hidden && entry.command.startsWith(typed),
  );
}
