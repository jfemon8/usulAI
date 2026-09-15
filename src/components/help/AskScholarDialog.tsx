"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { clsx } from "clsx";
import { HelpSheet } from "@/components/help/HelpSheet";
import { CheckIcon, CopyIcon, MailIcon, QuestionIcon } from "@/components/ui/Icons";
import { HELP_CONFIG } from "@/config/site";
import { helpExcerpt, helpRequestStore } from "@/lib/help/clientStore";

export interface AskScholarContext {
  aiAnswer: string;
  references: string[];
}

const NAME_CHARS = 80;
const AI_ANSWER_CHARS = 8_000;
const MAX_REFERENCES = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FALLBACK_ERROR = "প্রশ্নটি পাঠানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।";

const CONTROL =
  "w-full rounded-xl border border-(--border) bg-(--bg) px-3 text-base text-(--text-1) outline-none transition placeholder:text-(--text-3) focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft) disabled:bg-(--surface-2)";

function bn(value: number): string {
  return value.toLocaleString("bn-BD");
}

function FieldBlock({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-(--text-1)">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} className="text-xs leading-5 text-(--danger)">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-message`} className="text-xs leading-5 text-(--text-3)">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={clsx("tabular-nums", value.length > max && "text-(--danger)")}>
      {bn(value.length)}/{bn(max)}
    </span>
  );
}

interface Created {
  token: string;
  path: string;
  url: string;
}

function AskScholarForm({
  initialQuestion,
  context,
  onClose,
}: {
  initialQuestion: string;
  context?: AskScholarContext;
  onClose: () => void;
}) {
  const formId = useId();
  const ids = {
    question: useId(),
    details: useId(),
    name: useId(),
    email: useId(),
    website: useId(),
  };
  const [question, setQuestion] = useState(initialQuestion);
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const trimmedQuestion = question.trim();
  const trimmedEmail = email.trim();
  const questionError = !trimmedQuestion
    ? touched
      ? "প্রশ্নটি লিখুন।"
      : null
    : trimmedQuestion.length > HELP_CONFIG.maxQuestionChars
      ? `প্রশ্ন সর্বোচ্চ ${bn(HELP_CONFIG.maxQuestionChars)} অক্ষর হতে পারে।`
      : null;
  const detailsError =
    details.trim().length > HELP_CONFIG.maxDetailsChars
      ? `বিস্তারিত সর্বোচ্চ ${bn(HELP_CONFIG.maxDetailsChars)} অক্ষর হতে পারে।`
      : null;
  const nameError =
    name.trim().length > NAME_CHARS ? `নাম সর্বোচ্চ ${bn(NAME_CHARS)} অক্ষর হতে পারে।` : null;
  const emailError =
    trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail) ? "ইমেইল ঠিকানাটি সঠিক নয়।" : null;
  const invalid = !trimmedQuestion || questionError || detailsError || nameError || emailError;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (invalid || sending) return;
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          details: details.trim(),
          name: name.trim(),
          email: trimmedEmail,
          website,
          ...(context
            ? {
                context: {
                  aiAnswer: context.aiAnswer.slice(0, AI_ANSWER_CHARS),
                  references: [...new Set(context.references.filter(Boolean))].slice(
                    0,
                    MAX_REFERENCES,
                  ),
                },
              }
            : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        token?: string;
        path?: string;
        createdAt?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.token || !body.path) {
        setError(body?.error ?? FALLBACK_ERROR);
        return;
      }
      helpRequestStore.add({
        token: body.token,
        excerpt: helpExcerpt(trimmedQuestion),
        createdAt: body.createdAt ?? new Date().toISOString(),
      });
      setCreated({
        token: body.token,
        path: body.path,
        url: `${window.location.origin}${body.path}`,
      });
    } catch {
      setError(FALLBACK_ERROR);
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      linkRef.current?.select();
    }
  }

  if (created) {
    return (
      <HelpSheet
        title="প্রশ্নটি পাঠানো হয়েছে"
        description="আলেমগণ প্রশ্নটি দেখে উত্তর দেবেন, ইং-শা-আল্লাহ।"
        onClose={onClose}
        footer={
          <>
            <Link
              href={HELP_CONFIG.path}
              target="_blank"
              rel="noopener"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-(--border) px-4 text-sm font-medium text-(--text-1) transition hover:bg-(--surface-2) sm:h-10"
            >
              আমার প্রশ্নগুলো
            </Link>
            <button
              type="button"
              onClick={onClose}
              data-autofocus
              className="inline-flex h-11 items-center justify-center rounded-xl bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast) transition hover:bg-(--accent-strong) sm:h-10"
            >
              ঠিক আছে
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-(--accent-soft) px-4 py-3 text-sm text-(--text-1)">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-(--accent)" />
            <p className="leading-6">
              নিচের লিংকে গিয়ে যেকোনো সময় প্রশ্নের অবস্থা ও উত্তর দেখতে পারবেন। লিংকটি এই
              ব্রাউজারে সংরক্ষিত থাকল, তবু নিরাপদ কোথাও রেখে দিন। লিংক যার কাছে থাকবে, সে-ই প্রশ্ন ও
              উত্তর দেখতে পারবে।
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-link`} className="text-sm font-medium">
              ট্র্যাকিং লিংক
            </label>
            <div className="flex gap-2">
              <input
                id={`${formId}-link`}
                ref={linkRef}
                readOnly
                value={created.url}
                onFocus={(event) => event.currentTarget.select()}
                className={clsx(CONTROL, "h-11 min-w-0 flex-1 font-mono text-sm sm:h-10")}
              />
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-(--border) px-3 text-sm font-medium transition hover:bg-(--surface-2) sm:h-10"
                aria-label={copied ? "লিংক কপি হয়েছে" : "লিংক কপি করুন"}
              >
                {copied ? (
                  <CheckIcon className="h-4 w-4 text-(--accent)" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
                <span>{copied ? "কপি হয়েছে" : "কপি"}</span>
              </button>
            </div>
            <span role="status" className="sr-only">
              {copied ? "লিংক কপি হয়েছে" : ""}
            </span>
          </div>
          <Link
            href={created.path}
            target="_blank"
            rel="noopener"
            className="text-sm font-medium text-(--accent) underline-offset-4 hover:underline"
          >
            প্রশ্নের অবস্থা এখনই দেখুন
          </Link>
          {trimmedEmail ? (
            <p className="flex items-start gap-2 text-sm leading-6 text-(--text-2)">
              <MailIcon className="mt-1 h-4 w-4 shrink-0 text-(--text-3)" />
              উত্তর দেওয়া হলে {trimmedEmail} ঠিকানায় ইমেইল পাঠানো হবে।
            </p>
          ) : null}
        </div>
      </HelpSheet>
    );
  }

  return (
    <HelpSheet
      title="আলেমের কাছে প্রশ্ন পাঠান"
      description="AI উত্তরে সন্তুষ্ট না হলে বা বিষয়টি নিশ্চিত হতে চাইলে আমাদের আলেমদের জিজ্ঞেস করুন।"
      onClose={onClose}
      busy={sending}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-(--border) px-4 text-sm font-medium text-(--text-1) transition hover:bg-(--surface-2) disabled:opacity-60 sm:h-10"
          >
            বাতিল
          </button>
          <button
            type="submit"
            form={formId}
            disabled={sending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast) transition hover:bg-(--accent-strong) disabled:bg-(--surface-3) disabled:text-(--text-3) sm:h-10"
          >
            {sending ? (
              <span
                aria-hidden="true"
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
              />
            ) : (
              <QuestionIcon className="h-4 w-4" />
            )}
            {sending ? "পাঠানো হচ্ছে…" : "প্রশ্ন পাঠান"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FieldBlock
          id={ids.question}
          label="আপনার প্রশ্ন"
          error={questionError}
          hint={<Counter value={question} max={HELP_CONFIG.maxQuestionChars} />}
        >
          <textarea
            id={ids.question}
            dir="auto"
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-invalid={Boolean(questionError)}
            aria-describedby={`${ids.question}-message`}
            required
            className={clsx(CONTROL, "thin-scroll min-h-24 resize-y py-2.5 leading-6")}
          />
        </FieldBlock>

        <FieldBlock
          id={ids.details}
          label="বিস্তারিত (ঐচ্ছিক)"
          error={detailsError}
          hint="প্রেক্ষাপট, শর্ত বা যা আলেমদের জানা দরকার লিখুন। ব্যক্তিগত পরিচয়ের তথ্য না দেওয়াই ভালো।"
        >
          <textarea
            id={ids.details}
            dir="auto"
            rows={4}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            aria-invalid={Boolean(detailsError)}
            aria-describedby={`${ids.details}-message`}
            className={clsx(CONTROL, "thin-scroll min-h-24 resize-y py-2.5 leading-6")}
          />
        </FieldBlock>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldBlock id={ids.name} label="নাম (ঐচ্ছিক)" error={nameError}>
            <input
              id={ids.name}
              value={name}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(nameError)}
              className={clsx(CONTROL, "h-11")}
            />
          </FieldBlock>
          <FieldBlock
            id={ids.email}
            label="ইমেইল (ঐচ্ছিক)"
            error={emailError}
            hint="শুধু উত্তর দেওয়া হলে আপনাকে জানাতে ব্যবহার করা হবে, কোথাও প্রকাশ করা হবে না।"
          >
            <input
              id={ids.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(emailError)}
              aria-describedby={`${ids.email}-message`}
              className={clsx(CONTROL, "h-11")}
            />
          </FieldBlock>
        </div>

        <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor={ids.website}>ওয়েবসাইট</label>
          <input
            id={ids.website}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>

        {context ? (
          <p className="rounded-xl bg-(--surface-2) px-4 py-3 text-xs leading-5 text-(--text-2)">
            এই প্রশ্নের সাথে AI-এর দেওয়া উত্তর ও তার {bn(context.references.length)}টি সূত্রও
            পাঠানো হবে, যাতে আলেমগণ ভুল থাকলে ধরতে পারেন।
          </p>
        ) : null}

        <p className="text-xs leading-5 text-(--text-3)">
          পাঠালে আমাদের আলেম ও মডারেটরগণ আপনার প্রশ্ন ও বিস্তারিত দেখতে পাবেন। ভালো উত্তর নাম ছাড়া
          মাসআলা হিসেবে প্রকাশ হতে পারে, যাতে অন্যরাও উপকৃত হন।
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-(--danger-soft) px-4 py-3 text-sm text-(--danger)"
          >
            {error}
          </p>
        ) : null}
      </form>
    </HelpSheet>
  );
}

export function AskScholarDialog({
  open,
  onClose,
  initialQuestion = "",
  context,
}: {
  open: boolean;
  onClose: () => void;
  initialQuestion?: string;
  context?: AskScholarContext;
}) {
  if (!open) return null;
  return <AskScholarForm initialQuestion={initialQuestion} context={context} onClose={onClose} />;
}
