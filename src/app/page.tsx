import { ChatWindow } from "@/components/chat/ChatWindow";
import { LogoBadge } from "@/components/ui/Logo";
import { SITE_NAME } from "@/config/site";

export default function HomePage() {
  return (
    <main className="mx-auto flex h-dvh w-full flex-col p-0 sm:p-3 md:p-6 lg:p-10 xl:px-20">
      <section className="glass glass-sheen glass-shell flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-t-0 sm:rounded-(--radius-shell) sm:border">
        <header className="flex items-center gap-3 border-b border-(--glass-border) px-4 py-3.5 sm:px-6 sm:py-4">
          <LogoBadge className="h-10 w-10" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {SITE_NAME}
            </h1>
            <p className="truncate text-xs text-(--text-3)">
              কুরআন · হাদিস · ইজমা · কিয়াস · সীরাত
            </p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
          <ChatWindow />
        </div>
      </section>
    </main>
  );
}
