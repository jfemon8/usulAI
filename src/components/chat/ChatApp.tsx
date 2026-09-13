"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { clsx } from "clsx";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { CloseIcon, MenuIcon, PenIcon, SidebarIcon, TrashIcon } from "@/components/ui/Icons";
import { LogoMark } from "@/components/ui/Logo";
import { SITE_NAME } from "@/config/site";
import {
  conversationStore,
  deriveTitle,
  upsertConversation,
  type Conversation,
} from "@/lib/chat/conversations";
import type { UsulUIMessage } from "@/types";

interface ActiveChat {
  id: string;
  messages: UsulUIMessage[];
}

function newChat(): ActiveChat {
  return { id: crypto.randomUUID(), messages: [] };
}

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-lg text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1)",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Brand({ small }: { small?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-lg text-(--accent)",
          small ? "h-7 w-7" : "h-8 w-8",
        )}
      >
        <LogoMark className="h-full w-full" />
      </span>
      <span className="truncate text-[0.9375rem] font-semibold tracking-tight text-(--text-1)">
        {SITE_NAME}
      </span>
    </div>
  );
}

function SidebarContent({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
  onClose,
}: {
  conversations: Conversation[];
  activeId: string;
  onNew: () => void;
  onSelect: (conversation: Conversation) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <Brand />
        <IconButton label="সাইডবার বন্ধ করুন" onClick={onClose}>
          <span className="hidden lg:block">
            <SidebarIcon className="h-5 w-5" />
          </span>
          <span className="lg:hidden">
            <CloseIcon className="h-5 w-5" />
          </span>
        </IconButton>
      </div>

      <div className="px-2">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-(--text-1) transition hover:bg-(--surface-2)"
        >
          <PenIcon className="h-4 w-4" />
          নতুন চ্যাট
        </button>
      </div>

      <nav
        className="thin-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-2"
        aria-label="আগের কথোপকথন"
      >
        {conversations.length > 0 ? (
          <>
            <p className="px-3 pb-1.5 text-xs font-medium text-(--text-3)">সাম্প্রতিক</p>
            <ul className="space-y-0.5">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    aria-current={conversation.id === activeId ? "page" : undefined}
                    className={clsx(
                      "w-full truncate rounded-lg py-2 ps-3 pe-9 text-start text-sm transition",
                      conversation.id === activeId
                        ? "bg-(--surface-3) text-(--text-1)"
                        : "text-(--text-2) hover:bg-(--surface-2) hover:text-(--text-1)",
                    )}
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(conversation.id)}
                    aria-label={`"${conversation.title}" মুছুন`}
                    title="মুছুন"
                    className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-(--text-3) opacity-100 transition group-hover:opacity-100 hover:bg-(--surface-3) hover:text-(--text-1) lg:opacity-0 lg:focus:opacity-100"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="px-3 text-xs leading-5 text-(--text-3)">
            আপনার কথোপকথন এখানে সংরক্ষিত থাকবে।
          </p>
        )}
      </nav>

      <div className="shrink-0 border-t border-(--border) px-4 py-3 text-xs leading-5 text-(--text-3)">
        কুরআন · হাদিস · ইজমা · কিয়াস · সীরাত
      </div>
    </div>
  );
}

export function ChatApp({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState<ActiveChat>(newChat);
  const stored = useSyncExternalStore(
    conversationStore.subscribe,
    conversationStore.getSnapshot,
    conversationStore.getServerSnapshot,
  );
  const conversations = compact ? [] : stored;
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const handleSettled = useCallback(
    (messages: UsulUIMessage[]) => {
      if (compact) return;
      conversationStore.update((current) => {
        const existing = current.find((item) => item.id === active.id);
        const unchanged =
          existing &&
          existing.messages.length === messages.length &&
          existing.messages.at(-1)?.id === messages.at(-1)?.id;
        if (unchanged) return current;

        return upsertConversation(current, {
          id: active.id,
          title: deriveTitle(messages),
          updatedAt: Date.now(),
          messages,
        });
      });
    },
    [active.id, compact],
  );

  function startNew() {
    setActive(newChat());
    setDrawerOpen(false);
  }

  function select(conversation: Conversation) {
    setActive({ id: conversation.id, messages: conversation.messages });
    setDrawerOpen(false);
  }

  function remove(id: string) {
    conversationStore.update((current) => current.filter((item) => item.id !== id));
    if (id === active.id) setActive(newChat());
  }

  const chat = (
    <ChatWindow
      key={active.id}
      chatId={active.id}
      initialMessages={active.messages}
      onMessagesSettled={handleSettled}
      compact={compact}
    />
  );

  if (compact) {
    return (
      <div className="flex h-dvh flex-col bg-(--bg)">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-(--border) px-3">
          <Brand small />
          <IconButton label="নতুন চ্যাট" onClick={startNew}>
            <PenIcon className="h-4 w-4" />
          </IconButton>
        </header>
        {chat}
      </div>
    );
  }

  const sidebarProps = {
    conversations,
    activeId: active.id,
    onNew: startNew,
    onSelect: select,
    onDelete: remove,
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-(--bg)">
      <aside
        className={clsx(
          "hidden shrink-0 border-e border-(--border) bg-(--sidebar-bg) transition-[width] duration-200 lg:block",
          desktopOpen ? "w-[272px]" : "w-0 overflow-hidden border-e-0",
        )}
      >
        <div className="h-full w-[272px]">
          <SidebarContent {...sidebarProps} onClose={() => setDesktopOpen(false)} />
        </div>
      </aside>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="মেনু"
        >
          <button
            type="button"
            aria-label="মেনু বন্ধ করুন"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[84%] max-w-[300px] [animation:drawer-in_0.22s_ease-out] bg-(--sidebar-bg) pt-[env(safe-area-inset-top)] shadow-2xl">
            <SidebarContent {...sidebarProps} onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-2 sm:px-3">
          <div className="flex min-w-0 items-center gap-1">
            <IconButton
              label="মেনু খুলুন"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </IconButton>
            {!desktopOpen ? (
              <IconButton
                label="সাইডবার খুলুন"
                onClick={() => setDesktopOpen(true)}
                className="hidden lg:flex"
              >
                <SidebarIcon className="h-5 w-5" />
              </IconButton>
            ) : null}
            <div className={clsx("ms-1", desktopOpen && "lg:ms-2")}>
              <div className="lg:hidden">
                <Brand small />
              </div>
              <p className="hidden truncate text-[0.9375rem] font-semibold text-(--text-1) lg:block">
                {SITE_NAME}
                <span className="ms-2 text-xs font-normal text-(--text-3)">
                  দলিলভিত্তিক ইসলামিক প্রশ্নোত্তর
                </span>
              </p>
            </div>
          </div>
          <IconButton
            label="নতুন চ্যাট"
            onClick={startNew}
            className={clsx(desktopOpen && "lg:hidden")}
          >
            <PenIcon className="h-5 w-5" />
          </IconButton>
        </header>
        {chat}
      </main>
    </div>
  );
}
