"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { Button, Field, Input, Notice } from "@/components/admin/ui";
import { ADMIN_CONFIG } from "@/config/site";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi<{ redirect: string }>("/api/admin/auth/login", {
        body: { email, password },
      });
      router.replace(result.redirect);
      router.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="ইমেইল">
        {(id) => (
          <Input
            id={id}
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>
      <Field label="পাসওয়ার্ড">
        {(id) => (
          <PasswordInput
            id={id}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>
      <div className="flex justify-end">
        <Link
          href={ADMIN_CONFIG.paths.forgotPassword}
          className="text-sm text-(--accent) hover:underline"
        >
          পাসওয়ার্ড ভুলে গেছেন?
        </Link>
      </div>
      <Button type="submit" tone="primary" loading={busy} className="h-11 w-full">
        লগইন
      </Button>
    </form>
  );
}
