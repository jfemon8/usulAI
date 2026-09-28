import { GENERAL_ASSISTANT_CONFIG } from "@/config/site";

export function clientTimeZoneHeaders(): Record<string, string> {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone ? { [GENERAL_ASSISTANT_CONFIG.timeZoneHeader]: timeZone } : {};
  } catch {
    return {};
  }
}
