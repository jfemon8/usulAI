"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { clsx } from "clsx";
import { AnswerMarkdown } from "@/components/chat/AnswerMarkdown";
import { Composer } from "@/components/chat/Composer";
import { MessageActions } from "@/components/chat/MessageActions";
import { SourceCitationList } from "@/components/chat/SourceCitation";
import { UsageModal } from "@/components/chat/UsageModal";
import { ArrowDownIcon, RetryIcon } from "@/components/ui/Icons";
import { LogoMark } from "@/components/ui/Logo";
import { messageText } from "@/lib/chat/conversations";
import { readableChatError } from "@/lib/utils/chatError";
import type { AnswerSource, UsulUIMessage } from "@/types";

interface ChatWindowProps {
  chatId: string;
  initialMessages?: UsulUIMessage[];
  onMessagesSettled?: (messages: UsulUIMessage[]) => void;
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
  "প্রতিবেশীর হক সম্পর্কে হাদিসে কী আছে?",
  "ধৈর্য সম্পর্কে কুরআন কী বলে?",
  "ইয়াতিমের অধিকার নিয়ে ইসলাম কী বলে?",
  "ঋণ পরিশোধ নিয়ে শরীয়তের বিধান কী?",
  "মিথ্যা বলার ব্যাপারে হাদিসে কী সতর্কতা আছে?",
  "ফজরের নামাজের ফজিলত কী?",
  "জামাআতে নামাজ পড়ার গুরুত্ব কী?",
  "সফরে নামাজ কসর করার নিয়ম কী?",
  "তায়াম্মুম কখন করা যায়?",
  "ফরজ গোসল কখন ওয়াজিব হয়?",
  "রমযানের শেষ দশকের আমল কী?",
  "লাইলাতুল কদরের ফজিলত কী?",
  "সাদাকাতুল ফিতর কাদের উপর ওয়াজিব?",
  "কুরবানি কার উপর ওয়াজিব?",
  "উমরা করার ফজিলত কী?",
  "ইতিকাফের বিধান কী?",
  "দুআ কবুলের সময়গুলো কী কী?",
  "সকাল-সন্ধ্যার যিকিরের ফজিলত কী?",
  "দরুদ পাঠের ফজিলত কী?",
  "কুরআন তিলাওয়াতের ফজিলত সম্পর্কে হাদিসে কী আছে?",
  "সূরা ফাতিহার গুরুত্ব কী?",
  "আয়াতুল কুরসির ফজিলত কী?",
  "শিরক কাকে বলে, এর পরিণাম কী?",
  "তাকদিরে বিশ্বাস সম্পর্কে ইসলাম কী বলে?",
  "কিয়ামতের আলামত সম্পর্কে হাদিসে কী এসেছে?",
  "জান্নাতে যাওয়ার আমলগুলো কী কী?",
  "অহংকার সম্পর্কে কুরআন কী বলে?",
  "হিংসা থেকে বাঁচার উপায় কী?",
  "রাগ নিয়ন্ত্রণ সম্পর্কে হাদিসে কী আছে?",
  "আত্মীয়তার সম্পর্ক ছিন্ন করার পরিণাম কী?",
  "স্ত্রীর প্রতি স্বামীর দায়িত্ব কী?",
  "সন্তানের প্রতি বাবা-মায়ের দায়িত্ব কী?",
  "বিয়ের সুন্নত পদ্ধতি কী?",
  "মোহরানা সম্পর্কে কুরআন কী বলে?",
  "তালাকের বিধান কী?",
  "পর্দা সম্পর্কে কুরআনে কী নির্দেশ এসেছে?",
  "মদ ও জুয়া সম্পর্কে কুরআন কী বলে?",
  "ব্যবসায় সততা সম্পর্কে হাদিসে কী আছে?",
  "ওজনে কম দেওয়ার শাস্তি কী?",
  "ঘুষ দেওয়া-নেওয়ার বিধান কী?",
  "অন্যের সম্পদ অন্যায়ভাবে খাওয়ার পরিণাম কী?",
  "মিসকিনকে খাওয়ানোর ফজিলত কী?",
  "অসুস্থ ব্যক্তিকে দেখতে যাওয়ার ফজিলত কী?",
  "জানাযার নামাজের ফজিলত কী?",
  "কবর জিয়ারতের বিধান কী?",
  "মৃত ব্যক্তির জন্য কোন আমল কাজে আসে?",
  "খাবার খাওয়ার সুন্নতগুলো কী কী?",
  "ঘুমানোর আগের সুন্নত আমল কী?",
  "মেহমানদারির গুরুত্ব কী?",
  "সৎকাজের আদেশ ও অসৎকাজে নিষেধের গুরুত্ব কী?",
  "শুকরিয়া আদায় সম্পর্কে কুরআন কী বলে?",
  "বিপদে ধৈর্য ধরার পুরস্কার কী?",
  "জ্ঞান অর্জনের ফজিলত সম্পর্কে হাদিসে কী আছে?",
  "প্রতিশ্রুতি রক্ষা সম্পর্কে কুরআন কী বলে?",
  "জিহ্বার হেফাজত সম্পর্কে হাদিসে কী আছে?",
  "নিয়তের গুরুত্ব সম্পর্কে হাদিস কী?",
];

const NO_SUGGESTIONS: string[] = [];
const BOTTOM_THRESHOLD_PX = 96;
let cachedSuggestions: string[] | null = null;

function pickSuggestions(): string[] {
  if (cachedSuggestions) return cachedSuggestions;
  const pool = [...QUESTION_POOL];
  const picked: string[] = [];
  while (picked.length < 4 && pool.length > 0) {
    const [question] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    if (question) picked.push(question);
  }
  cachedSuggestions = picked;
  return picked;
}

function useSuggestions(): string[] {
  return useSyncExternalStore(
    () => () => {},
    pickSuggestions,
    () => NO_SUGGESTIONS,
  );
}

function messageSources(message: UsulUIMessage): AnswerSource[] | null {
  for (const part of message.parts) {
    if (part.type === "data-sources") return part.data;
  }
  return null;
}

function isRetryable(message: UsulUIMessage): boolean {
  return message.parts.some((part) => part.type === "data-outcome" && part.data.retryable);
}

function questionBefore(messages: UsulUIMessage[], index: number): string {
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    const candidate = messages[cursor];
    if (candidate?.role === "user") return messageText(candidate);
  }
  return "";
}

function AssistantAvatar({ pulsing }: { pulsing?: boolean }) {
  return (
    <div
      className={clsx(
        "mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--border) text-(--accent) sm:flex",
        pulsing && "animate-pulse",
      )}
      aria-hidden="true"
    >
      <LogoMark className="h-5 w-5" />
    </div>
  );
}

function ThinkingRow({ foundSources }: { foundSources: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const label = foundSources ? "দলিল পাওয়া গেছে, উত্তর সাজানো হচ্ছে" : "দলিল খোঁজা হচ্ছে";

  return (
    <div className="flex gap-4" aria-hidden="true">
      <AssistantAvatar pulsing />
      <div className="flex min-h-8 flex-col justify-center">
        <p className="shimmer-text text-base font-medium">{label}…</p>
        {seconds >= 12 ? (
          <p className="mt-1 text-xs text-(--text-3)">
            {seconds} সেকেন্ড · দলিলসহ নির্ভুল উত্তর তৈরি হতে কিছুটা সময় লাগতে পারে
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ onPick, compact }: { onPick: (question: string) => void; compact: boolean }) {
  const suggestions = useSuggestions();

  return (
    <div className="flex w-full flex-col items-center text-center">
      <div
        className={clsx(
          "mb-4 flex items-center justify-center rounded-2xl border border-(--border) text-(--accent)",
          compact ? "h-11 w-11" : "h-14 w-14",
        )}
      >
        <LogoMark className={compact ? "h-7 w-7" : "h-9 w-9"} />
      </div>
      <p className="arabic mb-1 text-center text-(--text-2)" dir="rtl">
        بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
      </p>
      <h2
        className={clsx(
          "font-semibold tracking-tight text-(--text-1)",
          compact ? "text-xl" : "text-2xl sm:text-[1.75rem]",
        )}
      >
        আসসালামু আলাইকুম, কী জানতে চান?
      </h2>
      <p className="mt-2 max-w-xl text-sm text-balance text-(--text-3)">
        আপনার প্রশ্নের উত্তর আসবে শুধুমাত্র কুরআন, হাদিস, ইজমা, কিয়াস ও সীরাতের দলিল থেকে,
        ইং-শা-আল্লাহ।
      </p>

      {suggestions.length > 0 ? (
        <div
          className={clsx(
            "mt-6 grid w-full gap-2 text-start",
            compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
          )}
        >
          {suggestions.slice(0, compact ? 3 : 4).map((question, index) => (
            <button
              key={question}
              type="button"
              onClick={() => onPick(question)}
              className={clsx(
                "rounded-2xl border border-(--border) px-4 py-3 text-start text-sm text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1)",
                index >= 3 && "hidden sm:block",
              )}
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChatWindow({
  chatId,
  initialMessages,
  onMessagesSettled,
  compact = false,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [usageOpen, setUsageOpen] = useState(false);
  const closeUsage = useCallback(() => setUsageOpen(false), []);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const transport = useMemo(
    () => new DefaultChatTransport<UsulUIMessage>({ api: "/api/chat" }),
    [],
  );
  const { messages, sendMessage, regenerate, stop, status, error, clearError } =
    useChat<UsulUIMessage>({
      id: chatId,
      messages: initialMessages,
      transport,
      experimental_throttle: 40,
    });

  const isLoading = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const lastIsAssistant = lastMessage?.role === "assistant";
  const answerStarted = lastIsAssistant && messageText(lastMessage).length > 0;
  const isWaiting = isLoading && !answerStarted;
  const errorMessage = readableChatError(error);
  const isEmpty = messages.length === 0;

  const liveStatus = isWaiting
    ? "উত্তর খোঁজা হচ্ছে"
    : isLoading
      ? "উত্তর লেখা হচ্ছে"
      : !errorMessage && lastIsAssistant
        ? "উত্তর সম্পূর্ণ হয়েছে"
        : "";

  useEffect(() => {
    const element = scrollRef.current;
    if (element && stickRef.current) element.scrollTop = element.scrollHeight;
  }, [messages, isWaiting, errorMessage]);

  useEffect(() => {
    if (status === "ready" && messages.length > 0) onMessagesSettled?.(messages);
  }, [status, messages, onMessagesSettled]);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const near =
      element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_THRESHOLD_PX;
    stickRef.current = near;
    setAtBottom(near);
  }

  function scrollToBottom() {
    const element = scrollRef.current;
    if (!element) return;
    stickRef.current = true;
    setAtBottom(true);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isLoading) return;
    if (error) clearError();
    stickRef.current = true;
    sendMessage({ text: trimmed });
    setInput("");
    requestAnimationFrame(scrollToBottom);
  }

  function retry() {
    if (isLoading) return;
    if (error) clearError();
    stickRef.current = true;
    void regenerate();
  }

  const column = compact ? "max-w-none px-3" : "max-w-5xl px-4 sm:px-6";

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={() => send(input)}
      onCommand={() => {
        setInput("");
        setUsageOpen(true);
      }}
      onStop={() => void stop()}
      busy={isLoading}
      autoFocus
      compact={compact}
    />
  );

  const usageModal = (
    <UsageModal open={usageOpen} onClose={closeUsage} messages={messages} persistent={!compact} />
  );

  if (isEmpty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={clsx(
            "thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto",
            compact ? "justify-center" : "justify-center md:pb-[8vh]",
          )}
        >
          <div className={clsx("mx-auto w-full py-6", column)}>
            <EmptyState onPick={send} compact={compact} />
            {!compact ? <div className="mt-6 hidden md:block">{composer}</div> : null}
          </div>
        </div>
        <div
          className={clsx(
            "shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            !compact && "md:hidden",
          )}
        >
          <div className={clsx("mx-auto w-full", column)}>{composer}</div>
        </div>
        {usageModal}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="thin-scroll min-h-0 flex-1 overflow-y-auto"
      >
        <div
          role="log"
          aria-label="কথোপকথন"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={isLoading}
          className={clsx("mx-auto flex w-full flex-col gap-8 pt-4 pb-8", column)}
        >
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;

            if (message.role === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-3xl bg-(--surface-2) px-4 py-2.5 text-base leading-7 wrap-break-word whitespace-pre-wrap text-(--text-1) sm:max-w-[75%] sm:px-5">
                    {messageText(message)}
                  </div>
                </div>
              );
            }

            const text = messageText(message);
            const sources = messageSources(message);
            const streaming = isLast && isLoading;

            if (text.length === 0) {
              return streaming ? (
                <ThinkingRow key={message.id} foundSources={sources !== null} />
              ) : null;
            }

            return (
              <article key={message.id} className="flex gap-4">
                <AssistantAvatar />
                <div className="min-w-0 flex-1">
                  <AnswerMarkdown text={text} streaming={streaming} />
                  {!streaming && sources !== null ? <SourceCitationList sources={sources} /> : null}
                  {!streaming && isLast && isRetryable(message) ? (
                    <button
                      type="button"
                      onClick={retry}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-(--border) px-4 py-2 text-sm font-medium text-(--text-1) transition hover:bg-(--surface-2)"
                    >
                      <RetryIcon className="h-4 w-4" />
                      আবার চেষ্টা করুন
                    </button>
                  ) : null}
                  {!streaming ? (
                    <MessageActions
                      question={questionBefore(messages, index)}
                      answer={text}
                      sources={sources ?? []}
                      onRetry={isLast && !isLoading ? retry : undefined}
                    />
                  ) : null}
                </div>
              </article>
            );
          })}

          {isWaiting && !lastIsAssistant ? <ThinkingRow foundSources={false} /> : null}

          {errorMessage && !isLoading ? (
            <div role="alert" className="flex gap-4">
              <AssistantAvatar />
              <div className="min-w-0 flex-1 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3">
                <p className="text-sm text-(--text-1)">{errorMessage}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--bg) px-3.5 py-1.5 text-sm font-medium text-(--text-1) transition hover:bg-(--surface-2)"
                >
                  <RetryIcon className="h-4 w-4" />
                  আবার চেষ্টা করুন
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!atBottom ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-28 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-(--border) bg-(--bg) text-(--text-2) shadow-(--composer-shadow) transition hover:text-(--text-1)"
          aria-label="নিচে যান"
        >
          <ArrowDownIcon className="h-4 w-4" />
        </button>
      ) : null}

      <div className="shrink-0 bg-(--bg) pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className={clsx("mx-auto w-full", column)}>
          {composer}
          <p className="py-2 text-center text-[0.6875rem] leading-4 text-(--text-3)">
            Usul AI ভুল করতে পারে। অনুগ্রহ পূর্বক গুরুত্বপূর্ণ মাসআলার জন্য যোগ্য আলেমের পরামর্শ
            নিন।
          </p>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </p>
      {usageModal}
    </div>
  );
}
