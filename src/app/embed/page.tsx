import { ChatWindow } from "@/components/chat/ChatWindow";
import { LogoBadge } from "@/components/ui/Logo";
import { SITE_NAME } from "@/config/site";

export default function EmbedPage() {
  return (
    <main className="flex h-dvh flex-col p-2.5">
      <section className="glass glass-sheen glass-shell flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2.5 border-b border-(--glass-border) px-3.5 py-2.5">
          <LogoBadge className="h-8 w-8 rounded-lg" />
          <h1 className="truncate text-sm font-semibold tracking-tight">{SITE_NAME}</h1>
        </header>

        <div className="flex min-h-0 flex-1 flex-col p-2.5">
          <ChatWindow compact />
        </div>
      </section>
    </main>
  );
}
