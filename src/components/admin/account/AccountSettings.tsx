"use client";

import { useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import { PasswordInput } from "@/components/admin/PasswordInput";
import {
  Badge,
  Button,
  Card,
  Field,
  formatWhen,
  LoadError,
  Notice,
  PageHeader,
  Skeleton,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { ADMIN_CONFIG } from "@/config/site";
import type { SessionSummary } from "@/lib/admin/sessions";

interface AccountData {
  account: {
    email: string;
    hasPassword: boolean;
    passwordChangedAt: string | null;
    lastLoginAt: string | null;
    emailConfigured: boolean;
    emailSender: string;
    demoSender: boolean;
  } | null;
  sessions: SessionSummary[];
}

function describeDevice(userAgent: string): string {
  if (!userAgent) return "অজানা ডিভাইস";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "ব্রাউজার";
  const system = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return system ? `${browser}, ${system}` : browser;
}

function ChangePassword() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi<{ signedOut: number }>("/api/admin/auth/password", {
        body: { current, password, confirmation, signOutOthers },
      });
      setCurrent("");
      setPassword("");
      setConfirmation("");
      toast.success(
        result.signedOut > 0
          ? `পাসওয়ার্ড পরিবর্তন হয়েছে, ${result.signedOut}টি অন্য সেশন বন্ধ করা হয়েছে।`
          : "পাসওয়ার্ড পরিবর্তন হয়েছে।",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="পাসওয়ার্ড পরিবর্তন"
      description={`নতুন পাসওয়ার্ড অন্তত ${ADMIN_CONFIG.minPasswordChars} অক্ষরের হতে হবে।`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Field label="বর্তমান পাসওয়ার্ড">
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="current-password"
              required
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="নতুন পাসওয়ার্ড">
            {(id) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                required
                minLength={ADMIN_CONFIG.minPasswordChars}
                maxLength={ADMIN_CONFIG.maxPasswordChars}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
          <Field label="নতুন পাসওয়ার্ড আবার">
            {(id) => (
              <PasswordInput
                id={id}
                autoComplete="new-password"
                required
                maxLength={ADMIN_CONFIG.maxPasswordChars}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            )}
          </Field>
        </div>
        <label className="flex min-h-10 items-center gap-3 text-sm text-(--text-2)">
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(event) => setSignOutOthers(event.target.checked)}
            className="h-5 w-5 accent-(--accent)"
          />
          অন্য সব ডিভাইস থেকে লগআউট করুন
        </label>
        <div className="flex justify-end">
          <Button type="submit" tone="primary" loading={busy} className="w-full sm:w-auto">
            পাসওয়ার্ড পরিবর্তন করুন
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function AccountSettings() {
  const toast = useToast();
  const { data, error, loading, reload } = useAdminData<AccountData>("/api/admin/auth/sessions");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);

  async function revoke(body: { id: string } | { others: true }) {
    setRevoking("id" in body ? body.id : "others");
    try {
      await adminApi("/api/admin/auth/sessions", { method: "DELETE", body });
      toast.success("id" in body ? "সেশনটি বন্ধ করা হয়েছে।" : "অন্য সব সেশন বন্ধ করা হয়েছে।");
      setConfirmOthers(false);
      reload();
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setRevoking(null);
    }
  }

  const others = data?.sessions.filter((session) => !session.current).length ?? 0;

  return (
    <>
      <PageHeader
        title="অ্যাকাউন্ট"
        description="অ্যাডমিন অ্যাকাউন্ট কোডে নির্দিষ্ট, তাই এখান থেকে তৈরি বা মুছে ফেলা যায় না। পাসওয়ার্ড আর লগইন করা ডিভাইস এখান থেকে পরিচালনা করুন।"
      />
      {error ? (
        <div className="mb-5">
          <LoadError message={error} onRetry={reload} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card title="অ্যাকাউন্টের তথ্য">
            {data?.account ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
                <dt className="text-(--text-3)">ইমেইল</dt>
                <dd className="break-all text-(--text-1)">{data.account.email}</dd>
                <dt className="text-(--text-3)">শেষ লগইন</dt>
                <dd className="text-(--text-1)">{formatWhen(data.account.lastLoginAt)}</dd>
                <dt className="text-(--text-3)">পাসওয়ার্ড বদলানো হয়েছে</dt>
                <dd className="text-(--text-1)">{formatWhen(data.account.passwordChangedAt)}</dd>
                <dt className="text-(--text-3)">রিসেট ইমেইল পাঠানো হয়</dt>
                <dd className="break-all text-(--text-1)">
                  {data.account.emailConfigured ? data.account.emailSender : "কনফিগার করা নেই"}
                </dd>
              </dl>
            ) : loading ? (
              <Skeleton rows={2} />
            ) : null}
          </Card>
          <ChangePassword />
        </div>

        <Card
          title="লগইন করা ডিভাইস"
          description="সন্দেহজনক কোনো সেশন দেখলে সেটি বন্ধ করে পাসওয়ার্ড বদলান।"
          actions={
            others > 0 ? (
              <Button size="sm" tone="danger" onClick={() => setConfirmOthers(true)}>
                অন্য সব বন্ধ করুন
              </Button>
            ) : null
          }
        >
          {data ? (
            <ul className="flex flex-col divide-y divide-(--border)">
              {data.sessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-(--text-1)">
                      {describeDevice(session.userAgent)}
                      {session.current ? <Badge tone="accent">এই ডিভাইস</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-(--text-3)">
                      শুরু {formatWhen(session.createdAt)} · সর্বশেষ{" "}
                      {formatWhen(session.lastSeenAt)}
                    </p>
                  </div>
                  {!session.current ? (
                    <Button
                      size="sm"
                      onClick={() => void revoke({ id: session.id })}
                      loading={revoking === session.id}
                    >
                      বন্ধ করুন
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : loading ? (
            <Skeleton rows={3} />
          ) : null}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOthers}
        title="অন্য সব সেশন বন্ধ করবেন?"
        message="এই ডিভাইস ছাড়া বাকি সব ডিভাইস থেকে সাথে সাথে লগআউট হয়ে যাবে।"
        confirmLabel="বন্ধ করুন"
        busy={revoking === "others"}
        onConfirm={() => void revoke({ others: true })}
        onClose={() => setConfirmOthers(false)}
      />
    </>
  );
}
