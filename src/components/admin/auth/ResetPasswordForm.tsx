"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { Button, Field, Notice, Skeleton } from "@/components/admin/ui";
import { ADMIN_CONFIG } from "@/config/site";

type TokenState =
  | { status: "checking" }
  | { status: "valid"; email: string }
  | { status: "invalid"; message: string };

const MISSING = "রিসেট লিংকটি অসম্পূর্ণ। ইমেইলের পুরো লিংকটি খুলুন বা আবার অনুরোধ করুন।";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [tokenState, setTokenState] = useState<TokenState>(
    token ? { status: "checking" } : { status: "invalid", message: MISSING },
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    adminApi<{ email: string }>("/api/admin/auth/reset", { method: "PUT", body: { token } }).then(
      (result) => active && setTokenState({ status: "valid", email: result.email }),
      (failure: unknown) =>
        active && setTokenState({ status: "invalid", message: errorMessage(failure) }),
    );
    return () => {
      active = false;
    };
  }, [token]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await adminApi("/api/admin/auth/reset", { body: { token, password, confirmation } });
      setDone(true);
      setTimeout(() => router.replace(ADMIN_CONFIG.paths.login), 2500);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  if (tokenState.status === "checking") return <Skeleton rows={3} />;

  if (tokenState.status === "invalid") {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="danger">{tokenState.message}</Notice>
        <Link
          href={ADMIN_CONFIG.paths.forgotPassword}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast)"
        >
          নতুন রিসেট লিংক চান
        </Link>
      </div>
    );
  }

  if (done) {
    return <Notice>পাসওয়ার্ড পরিবর্তন হয়েছে। লগইন পেজে নিয়ে যাওয়া হচ্ছে…</Notice>;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="rounded-xl bg-(--surface-2) px-3 py-2 text-sm break-all text-(--text-2)">
        অ্যাকাউন্ট: {tokenState.email}
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <input type="email" autoComplete="username" value={tokenState.email} readOnly hidden />
      <Field label="নতুন পাসওয়ার্ড" hint={`অন্তত ${ADMIN_CONFIG.minPasswordChars} অক্ষর`}>
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
      <Field label="আবার লিখুন">
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
      <Button type="submit" tone="primary" loading={busy} className="h-11 w-full">
        পাসওয়ার্ড সেট করুন
      </Button>
    </form>
  );
}
