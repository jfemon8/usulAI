"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_CONFIG, STAFF_CONFIG } from "@/config/site";
import { Badge, Button, IconButton, Input } from "@/components/admin/ui";
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, RetryIcon } from "@/components/ui/Icons";
import { ROLE_LABELS, type StaffRole } from "@/lib/admin/roles";
import type { CategoryView, StaffStatus, StaffView } from "@/lib/admin/staff";

export type { CategoryView, StaffStatus, StaffView };

export interface EmailOutcome {
  sent: boolean;
  recipient: string;
  reason: string | null;
  demoSender: boolean;
}

export const ROLE_SUMMARIES: Record<StaffRole, { title: string; abilities: string[] }> = {
  moderator: {
    title: "সাইট ও AI পর্যবেক্ষণ, ব্যবস্থাপনা ও রক্ষণাবেক্ষণ",
    abilities: [
      "সাইট ও AI-এর কার্যক্রম পর্যবেক্ষণ",
      "সাইট কনটেন্ট ও AI সেটিংস বদলানো",
      "রক্ষণাবেক্ষণের কাজ চালানো",
      "রিভিউ ও মানুষের প্রশ্ন দেখা (উত্তর দেওয়া নয়)",
    ],
  },
  scholar: {
    title: "মুফতি, আলেম, ওলামা, ইমাম, শায়েখদের জন্য",
    abilities: [
      "AI-এর উত্তর রিভিউ ও সংশোধন",
      "মানুষের প্রশ্নের উত্তর দেওয়া",
      "মাসআলা ও ফতোয়া লেখা",
    ],
  },
};

export const CORE_DATA_NOTE =
  "কোনো স্টাফ দলিল ভান্ডার, ডাটাবেস, ফাইল, স্টাফ অ্যাকাউন্ট বা অডিট লগ দেখতে পারেন না; এগুলো শুধু অ্যাডমিনের জন্য।";

export const STATUS_LABELS: Record<StaffStatus, string> = {
  active: "সক্রিয়",
  suspended: "স্থগিত",
};

export function RoleBadge({ role }: { role: StaffRole | null }) {
  if (!role) return <Badge tone="danger">ভূমিকা নেই</Badge>;
  return <Badge tone={role === "scholar" ? "accent" : "neutral"}>{ROLE_LABELS[role]}</Badge>;
}

export function StatusBadge({ status }: { status: StaffStatus }) {
  return <Badge tone={status === "active" ? "accent" : "danger"}>{STATUS_LABELS[status]}</Badge>;
}

const PASSWORD_SETS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnpqrstuvwxyz",
  "23456789",
  "@#%+=?",
] as const;

function randomIndex(size: number): number {
  const limit = Math.floor(0x1_0000_0000 / size) * size;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < limit) return value % size;
  }
}

export function createPassword(length: number = STAFF_CONFIG.generatedPasswordChars): string {
  const size = Math.max(length, PASSWORD_SETS.length);
  const alphabet = PASSWORD_SETS.join("");
  const characters = PASSWORD_SETS.map((set) => set[randomIndex(set.length)] ?? "");
  while (characters.length < size) characters.push(alphabet[randomIndex(alphabet.length)] ?? "");
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    const current = characters[index] ?? "";
    characters[index] = characters[swap] ?? "";
    characters[swap] = current;
  }
  return characters.join("");
}

export function passwordError(password: string): string | null {
  if (password.length < ADMIN_CONFIG.minPasswordChars) {
    return `পাসওয়ার্ড অন্তত ${ADMIN_CONFIG.minPasswordChars} অক্ষরের হতে হবে।`;
  }
  if (password.length > ADMIN_CONFIG.maxPasswordChars) {
    return `পাসওয়ার্ড ${ADMIN_CONFIG.maxPasswordChars} অক্ষরের বেশি হতে পারবে না।`;
  }
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9০-৯+() -]*$/;

export function emailError(email: string): string | null {
  const value = email.trim();
  if (!value) return "ইমেইল দিন।";
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return "ইমেইল ঠিকানাটি সঠিক নয়।";
  return null;
}

export function nameError(name: string): string | null {
  const value = name.trim();
  if (!value) return "নাম দিন।";
  if (value.length > STAFF_CONFIG.maxNameChars) {
    return `নাম ${STAFF_CONFIG.maxNameChars} অক্ষরের বেশি হতে পারবে না।`;
  }
  return null;
}

export function phoneError(phone: string): string | null {
  const value = phone.trim();
  if (value.length > STAFF_CONFIG.maxPhoneChars) {
    return `ফোন নম্বর ${STAFF_CONFIG.maxPhoneChars} অক্ষরের বেশি হতে পারবে না।`;
  }
  if (!PHONE_PATTERN.test(value)) return "ফোন নম্বরে শুধু সংখ্যা, স্পেস, +, - ও () দেওয়া যাবে।";
  return null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!(await copyText(text))) return false;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
    return true;
  }, []);

  return { copied, copy };
}

export function CopyButton({
  text,
  label = "কপি করুন",
  onFailed,
}: {
  text: string;
  label?: string;
  onFailed?: () => void;
}) {
  const { copied, copy } = useCopy();
  return (
    <IconButton
      label={copied ? "কপি হয়েছে" : label}
      onClick={() => {
        void copy(text).then((ok) => {
          if (!ok) onFailed?.();
        });
      }}
      disabled={!text}
      className={copied ? "text-(--accent)" : undefined}
    >
      {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
    </IconButton>
  );
}

export function PasswordField({
  id,
  value,
  onChange,
  onCopyFailed,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onCopyFailed?: () => void;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            value={value}
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="off"
            maxLength={ADMIN_CONFIG.maxPasswordChars}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="pe-11 font-mono"
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
            aria-pressed={visible}
            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-(--text-3) hover:text-(--text-1)"
          >
            {visible ? (
              <EyeOffIcon className="h-[1.125rem] w-[1.125rem]" />
            ) : (
              <EyeIcon className="h-[1.125rem] w-[1.125rem]" />
            )}
          </button>
        </div>
        <CopyButton text={value} label="পাসওয়ার্ড কপি করুন" onFailed={onCopyFailed} />
      </div>
      <Button
        size="sm"
        disabled={disabled}
        icon={<RetryIcon className="h-4 w-4" />}
        onClick={() => {
          onChange(createPassword());
          setVisible(true);
        }}
        className="self-start"
      >
        স্বয়ংক্রিয় পাসওয়ার্ড তৈরি
      </Button>
    </div>
  );
}

export function EmailOutcomeNotice({ outcome }: { outcome: EmailOutcome }) {
  if (outcome.sent) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-xl bg-(--accent-soft) px-4 py-3 text-sm text-(--accent)"
      >
        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words">
          লগইনের তথ্যসহ ইমেইল <span className="font-medium break-all">{outcome.recipient}</span>{" "}
          ঠিকানায় পাঠানো হয়েছে। তবু পৌঁছেছে কি না জেনে নিন।
        </span>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl bg-(--warn-soft) px-4 py-3 text-sm text-(--warn)"
    >
      <p className="font-medium">ইমেইল পাঠানো যায়নি। পাসওয়ার্ডটি নিজে নিরাপদভাবে পৌঁছে দিন।</p>
      {outcome.reason ? <p className="break-words">কারণ: {outcome.reason}</p> : null}
      {outcome.demoSender ? (
        <p className="break-words">
          প্রেরক এখন Mailtrap-এর ডেমো ডোমেইন, যা শুধু Mailtrap অ্যাকাউন্টের মালিকের ঠিকানায় ইমেইল
          পৌঁছায়। অন্যদের কাছে পাঠাতে একটি যাচাই করা ডোমেইন যোগ করে EMAIL_FROM সেট করুন।
        </p>
      ) : null}
    </div>
  );
}

export function categoryOptionGroups(categories: readonly CategoryView[]) {
  return (["scholar", "moderator"] as const)
    .map((role) => ({
      role,
      label: ROLE_LABELS[role],
      items: categories.filter((category) => category.role === role),
    }))
    .filter((group) => group.items.length > 0);
}
