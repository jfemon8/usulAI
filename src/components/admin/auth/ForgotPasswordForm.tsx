"use client";

import { useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { Button, Field, Input, Notice } from "@/components/admin/ui";
import { ADMIN_CONFIG } from "@/config/site";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi<{ message: string }>("/api/admin/auth/forgot", {
        body: { email },
      });
      setSent(result.message);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <Notice>{sent}</Notice>
        <p className="text-sm leading-6 text-(--text-3)">
          লিংকটি {ADMIN_CONFIG.resetMinutes} মিনিট কার্যকর থাকবে এবং একবারই ব্যবহার করা যাবে।
        </p>
        <Button onClick={() => setSent(null)} className="w-full">
          আবার পাঠান
        </Button>
      </div>
    );
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
      <Field label="অ্যাকাউন্টের ইমেইল">
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
      <Button type="submit" tone="primary" loading={busy} className="h-11 w-full">
        রিসেট লিংক পাঠান
      </Button>
    </form>
  );
}
