"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { SourceCitationList } from "@/components/chat/SourceCitation";
import { LogoBadge } from "@/components/ui/Logo";
import type { AnswerSource, UsulUIMessage } from "@/types";

interface ChatWindowProps {
  compact?: boolean;
}

const QUESTION_POOL = [
  "নামাজের শর্ত কী কী?",
  "যাকাত কাদের উপর ফরজ?",
  "রোজা ভেঙে গেলে করণীয় কী?",
  "অজু ভঙ্গের কারণগুলো কী কী?",
  "তাহাজ্জুদ নামাজের ফজিলত কী?",
  "সুদ সম্পর্কে কুরআনে কী নির্দেশনা এসেছে?",
  "মা-বাবার সাথে আচরণ নিয়ে ইসলাম কী বলে?",
  "জুমার দিনের আমলগুলো কী কী?",
  "হজ কার উপর ফরজ হয়?",
  "গীবত কাকে বলে, এর বিধান কী?",
  "তাওবার শর্তগুলো কী কী?",
  "ইস্তিগফারের ফজিলত সম্পর্কে কী এসেছে?",
  "প্রতিবেশীর হক সম্পর্কে হাদিসে কী আছে?",
  "সদকায়ে জারিয়া বলতে কী বোঝায়?",
  "ধৈর্য সম্পর্কে কুরআন কী বলে?",
  "হালাল রিজিক অন্বেষণ নিয়ে কী নির্দেশনা আছে?",
  "রাসূলুল্লাহ ﷺ কীভাবে দিন শুরু করতেন?",
  "সালামের আদব কী কী?",
  "ইয়াতিমের অধিকার নিয়ে ইসলাম কী বলে?",
  "আমানত রক্ষা সম্পর্কে কী বলা হয়েছে?",
  "ঋণ পরিশোধ নিয়ে শরীয়তের বিধান কী?",
  "রমজানের রাতের ইবাদত সম্পর্কে কী এসেছে?",
  "কবিরা গুনাহ কাকে বলে?",
  "মিথ্যা বলার ব্যাপারে হাদিসে কী সতর্কতা আছে?",
];

const SUGGESTION_COUNT = 3;
const NO_SUGGESTIONS: string[] = [];

function pickRandomQuestions(pool: readonly string[], count: number): string[] {
  const remaining = [...pool];
  const picked: string[] = [];

  while (picked.length < count && remaining.length > 0) {
    const index = Math.floor(Math.random() * remaining.length);
    const [question] = remaining.splice(index, 1);
    if (question) picked.push(question);
  }

  return picked;
}

let cachedSuggestions: string[] | null = null;

function subscribeToSuggestions(): () => void {
  return () => {};
}

function getClientSuggestions(): string[] {
  if (!cachedSuggestions) {
    cachedSuggestions = pickRandomQuestions(QUESTION_POOL, SUGGESTION_COUNT);
  }
  return cachedSuggestions;
}

function getServerSuggestions(): string[] {
  return NO_SUGGESTIONS;
}

function messageText(parts: UsulUIMessage["parts"]): string {
  return parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function messageSources(parts: UsulUIMessage["parts"]): AnswerSource[] | null {
  for (const part of parts) {
    if (part.type === "data-sources") return part.data;
  }
  return null;
}

function TypingIndicator() {
  return (
    <div className="rise-in flex justify-start">
      <div className="glass glass-sheen glass-strong flex items-center gap-1.5 rounded-(--radius-bubble) px-4 py-3.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-(--text-2)"
            style={{ animation: `pulse-dot 1.3s ${index * 0.16}s infinite ease-in-out` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  const suggestions = useSyncExternalStore(
    subscribeToSuggestions,
    getClientSuggestions,
    getServerSuggestions,
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-2 py-8 text-center">
      <LogoBadge className="h-16 w-16 rounded-2xl" />

      <div className="space-y-2">
        <p className="arabic text-center text-(--accent)" dir="rtl">
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>
        <p className="text-base font-medium text-(--text-1)">আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ</p>
        <p className="mx-auto text-sm text-balance text-(--text-2)">
          আপনার জিজ্ঞাসার উত্তর খোঁজা হবে কুরআনুল কারীম, সহীহ হাদিস, ইজমায়ে উম্মাহ, কিয়াস ও
          সীরাতুন্নবী ﷺ তারতীব মেনে ইং-শা-আল্লাহ।
        </p>
        <p className="mx-auto text-xs text-balance text-(--text-3)">
          জটিল ও ব্যক্তিগত মাসআলায় নিকটস্থ যোগ্য আলেমের পরামর্শ নিন।
        </p>
      </div>

      <div className="flex min-h-18 flex-wrap content-start justify-center gap-2">
        {suggestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onPick(question)}
            className="glass glass-sheen rise-in rounded-full px-3.5 py-2 text-xs text-(--text-1) transition duration-200 hover:brightness-[1.08] active:scale-[0.97]"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatWindow({ compact = false }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport<UsulUIMessage>({ api: "/api/chat" }),
    [],
  );
  const { messages, sendMessage, status } = useChat<UsulUIMessage>({ transport });

  const isLoading = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const answerStarted =
    lastMessage?.role !== "user" && messageText(lastMessage?.parts ?? []).length > 0;
  const isWaiting = isLoading && !answerStarted;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, isWaiting]);

  function send(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isLoading) return;

    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div
      className={
        compact ? "flex h-full min-h-0 flex-col gap-3" : "flex min-h-0 flex-1 flex-col gap-3"
      }
    >
      <div ref={scrollRef} className="scroll-area -mx-1 min-h-0 flex-1 px-1">
        {messages.length === 0 ? (
          <EmptyState onPick={send} />
        ) : (
          <div className="flex flex-col gap-3 py-1">
            {messages.map((message) => {
              const isAssistant = message.role !== "user";
              const sources = isAssistant ? messageSources(message.parts) : null;
              const text = messageText(message.parts);

              if (isAssistant && text.length === 0) return null;

              return (
                <MessageBubble
                  key={message.id}
                  role={isAssistant ? "assistant" : "user"}
                  text={text}
                  footer={
                    isAssistant && sources !== null ? (
                      <SourceCitationList sources={sources} />
                    ) : null
                  }
                />
              );
            })}

            {isWaiting ? <TypingIndicator /> : null}
          </div>
        )}
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => send(input)}
        disabled={isLoading}
      />
    </div>
  );
}
