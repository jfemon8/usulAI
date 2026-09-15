"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ADMIN_CONFIG, STAFF_CONFIG } from "@/config/site";
import { adminApi, errorMessage } from "@/components/admin/api";
import { Dialog, useToast } from "@/components/admin/Dialog";
import { Badge, Button, Field, Input, Notice, Select, formatWhen } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { LockIcon, TrashIcon } from "@/components/ui/Icons";
import { ROLE_LABELS } from "@/lib/admin/roles";
import {
  CopyButton,
  EmailOutcomeNotice,
  PasswordField,
  ROLE_SUMMARIES,
  RoleBadge,
  STATUS_LABELS,
  StatusBadge,
  categoryOptionGroups,
  copyText,
  createPassword,
  emailError,
  nameError,
  passwordError,
  phoneError,
  type CategoryView,
  type EmailOutcome,
  type StaffStatus,
  type StaffView,
} from "@/components/admin/staff/shared";

export interface PasswordResult {
  kind: "created" | "reset";
  account: StaffView;
  password: string;
  email: EmailOutcome;
}

function CategorySelect({
  id,
  value,
  categories,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  categories: readonly CategoryView[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const known = categories.some((category) => category.id === value);
  return (
    <Select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {!known ? (
        <option value={value}>{value ? "অজানা ক্যাটাগরি" : "ক্যাটাগরি বেছে নিন"}</option>
      ) : null}
      {categoryOptionGroups(categories).map((group) => (
        <optgroup key={group.role} label={`${group.label} ভূমিকা`}>
          {group.items.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({group.label})
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

function RoleHint({ category }: { category: CategoryView | undefined }) {
  if (!category) return null;
  const summary = ROLE_SUMMARIES[category.role];
  return (
    <span>
      {ROLE_LABELS[category.role]}: {summary.abilities.join(", ")}।
    </span>
  );
}

export function CreateAccountDialog({
  categories,
  onClose,
  onCreated,
}: {
  categories: readonly CategoryView[];
  onClose: () => void;
  onCreated: (result: PasswordResult) => void;
}) {
  const toast = useToast();
  const [categoryId, setCategoryId] = useState(
    () => categories.find((category) => category.role === "scholar")?.id ?? categories[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(() => createPassword());
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = {
    categoryId: categories.some((category) => category.id === categoryId)
      ? null
      : "ক্যাটাগরি বেছে নিন।",
    name: nameError(name),
    email: emailError(email),
    phone: phoneError(phone),
    password: passwordError(password),
  };
  const invalid = Object.values(errors).some(Boolean);
  const shown = (key: keyof typeof errors) => (showErrors ? errors[key] : null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (invalid) return;
    setBusy(true);
    setServerError(null);
    try {
      const result = await adminApi<{ account: StaffView; email: EmailOutcome }>(
        "/api/admin/staff",
        {
          method: "POST",
          body: {
            categoryId,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
            password,
          },
        },
      );
      onCreated({ kind: "created", account: result.account, password, email: result.email });
    } catch (failure) {
      setServerError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const selected = categories.find((category) => category.id === categoryId);

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title="নতুন স্টাফ অ্যাকাউন্ট"
      description="অ্যাকাউন্ট তৈরি হলে লগইনের তথ্যসহ ইমেইল পাঠানো হবে এবং প্রথম লগইনে পাসওয়ার্ড বদলাতে বলা হবে।"
      footer={
        <>
          <Button onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            বাতিল
          </Button>
          <Button
            tone="primary"
            type="submit"
            form="staff-create-form"
            loading={busy}
            className="w-full sm:w-auto"
          >
            অ্যাকাউন্ট তৈরি করুন
          </Button>
        </>
      }
    >
      <form id="staff-create-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {serverError ? <Notice tone="danger">{serverError}</Notice> : null}
        <Field
          label="ক্যাটাগরি"
          error={shown("categoryId")}
          hint={<RoleHint category={selected} />}
        >
          {(id) => (
            <CategorySelect
              id={id}
              value={categoryId}
              categories={categories}
              onChange={setCategoryId}
              disabled={busy}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="নাম" error={shown("name")}>
            {(id) => (
              <Input
                id={id}
                value={name}
                maxLength={STAFF_CONFIG.maxNameChars}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field label="ফোন (ঐচ্ছিক)" error={shown("phone")}>
            {(id) => (
              <Input
                id={id}
                type="tel"
                inputMode="tel"
                value={phone}
                maxLength={STAFF_CONFIG.maxPhoneChars}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => setPhone(event.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="ইমেইল" error={shown("email")} hint="এই ইমেইল দিয়েই লগইন করবেন।">
          {(id) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              value={email}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <Field
          label="পাসওয়ার্ড"
          error={shown("password")}
          hint={`অন্তত ${ADMIN_CONFIG.minPasswordChars} অক্ষর। তৈরি হওয়ার পর একবার দেখানো হবে।`}
        >
          {(id) => (
            <PasswordField
              id={id}
              value={password}
              onChange={setPassword}
              disabled={busy}
              onCopyFailed={() => toast.error("কপি করা যায়নি। নিজে বেছে নিয়ে কপি করুন।")}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-(--text-3)">{label}</dt>
      <dd className="min-w-0 break-words text-(--text-1)">{children}</dd>
    </>
  );
}

export function EditAccountDialog({
  account: initial,
  categories,
  onClose,
  onSaved,
  onResetPassword,
  onDelete,
}: {
  account: StaffView;
  categories: readonly CategoryView[];
  onClose: () => void;
  onSaved: (account: StaffView) => void;
  onResetPassword: (account: StaffView) => void;
  onDelete: (account: StaffView) => void;
}) {
  const toast = useToast();
  const fresh = useAdminData<StaffView>(`/api/admin/staff/${initial.id}`);
  const account = fresh.data ?? initial;
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [status, setStatus] = useState<StaffStatus>(initial.status);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = {
    name: nameError(name),
    email: emailError(email),
    phone: phoneError(phone),
    categoryId: categories.some((category) => category.id === categoryId)
      ? null
      : "ক্যাটাগরি বেছে নিন।",
  };
  const shown = (key: keyof typeof errors) => (showErrors ? errors[key] : null);

  const nextEmail = email.trim().toLowerCase();
  const nextCategory = categories.find((category) => category.id === categoryId);
  const changes = {
    ...(name.trim() !== initial.name ? { name: name.trim() } : {}),
    ...(nextEmail !== initial.email ? { email: nextEmail } : {}),
    ...(phone.trim() !== (initial.phone ?? "") ? { phone: phone.trim() || null } : {}),
    ...(categoryId !== initial.categoryId ? { categoryId } : {}),
    ...(status !== initial.status ? { status } : {}),
  };
  const emailChanged = "email" in changes;
  const roleChanged = "categoryId" in changes && nextCategory?.role !== initial.role;
  const suspending = status === "suspended" && initial.status !== "suspended";
  const signsOut = emailChanged || roleChanged || suspending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    if (Object.keys(changes).length === 0) {
      toast.success("কিছু বদলানো হয়নি।");
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      const result = await adminApi<{ account: StaffView; signedOut: boolean }>(
        `/api/admin/staff/${initial.id}`,
        { method: "PATCH", body: changes },
      );
      toast.success(
        result.signedOut
          ? "অ্যাকাউন্ট হালনাগাদ হয়েছে এবং ব্যক্তিকে সব ডিভাইস থেকে লগআউট করা হয়েছে।"
          : "অ্যাকাউন্ট হালনাগাদ হয়েছে।",
      );
      onSaved(result.account);
    } catch (failure) {
      setServerError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title={initial.name}
      description={<span className="break-all">{initial.email}</span>}
      footer={
        <>
          <Button onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            বন্ধ করুন
          </Button>
          <Button
            tone="primary"
            type="submit"
            form="staff-edit-form"
            loading={busy}
            className="w-full sm:w-auto"
          >
            সংরক্ষণ করুন
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={account.status} />
          <RoleBadge role={account.role} />
          <Badge>{account.categoryName}</Badge>
          {account.mustChangePassword ? <Badge tone="warn">পাসওয়ার্ড নিজে বদলাননি</Badge> : null}
        </div>

        <form id="staff-edit-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          {serverError ? <Notice tone="danger">{serverError}</Notice> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="নাম" error={shown("name")}>
              {(id) => (
                <Input
                  id={id}
                  value={name}
                  maxLength={STAFF_CONFIG.maxNameChars}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>
            <Field label="ফোন (ঐচ্ছিক)" error={shown("phone")}>
              {(id) => (
                <Input
                  id={id}
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  maxLength={STAFF_CONFIG.maxPhoneChars}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(event) => setPhone(event.target.value)}
                />
              )}
            </Field>
          </div>
          <Field
            label="ইমেইল"
            error={shown("email")}
            hint="ইমেইল বদলালে ব্যক্তি সব ডিভাইস থেকে লগআউট হবেন এবং নতুন ইমেইলে লগইন করবেন।"
          >
            {(id) => (
              <Input
                id={id}
                type="email"
                inputMode="email"
                value={email}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="ক্যাটাগরি"
              error={shown("categoryId")}
              hint="ভূমিকা বদলে গেলে ব্যক্তি লগআউট হবেন।"
            >
              {(id) => (
                <CategorySelect
                  id={id}
                  value={categoryId}
                  categories={categories}
                  onChange={setCategoryId}
                  disabled={busy}
                />
              )}
            </Field>
            <Field label="অবস্থা" hint="স্থগিত অ্যাকাউন্টে লগইন করা যায় না।">
              {(id) => (
                <Select
                  id={id}
                  value={status}
                  disabled={busy}
                  onChange={(event) =>
                    setStatus(event.target.value === "suspended" ? "suspended" : "active")
                  }
                >
                  <option value="active">{STATUS_LABELS.active}</option>
                  <option value="suspended">{STATUS_LABELS.suspended}</option>
                </Select>
              )}
            </Field>
          </div>
          {signsOut ? (
            <Notice tone="warn">
              সংরক্ষণ করলে এই ব্যক্তি সব ডিভাইস থেকে সঙ্গে সঙ্গে লগআউট হবেন
              {suspending
                ? " এবং স্থগিত থাকা পর্যন্ত আর লগইন করতে পারবেন না"
                : roleChanged && nextCategory
                  ? `, আবার লগইন করলে ${ROLE_LABELS[nextCategory.role]} ভূমিকার অনুমতি পাবেন`
                  : ""}
              ।
            </Notice>
          ) : null}
        </form>

        <section className="rounded-xl border border-(--border) p-4">
          <h3 className="mb-3 text-sm font-semibold text-(--text-1)">অ্যাকাউন্টের তথ্য</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-y-2">
            <InfoRow label="তৈরি করেছেন">
              <span className="break-all">{account.createdBy}</span>
            </InfoRow>
            <InfoRow label="তৈরির সময়">{formatWhen(account.createdAt)}</InfoRow>
            <InfoRow label="সর্বশেষ হালনাগাদ করেছেন">
              <span className="break-all">{account.updatedBy}</span>
            </InfoRow>
            <InfoRow label="হালনাগাদের সময়">{formatWhen(account.updatedAt)}</InfoRow>
            <InfoRow label="শেষ লগইন">{formatWhen(account.lastLoginAt)}</InfoRow>
            <InfoRow label="নিজে পাসওয়ার্ড বদলেছেন">
              {formatWhen(account.passwordChangedAt)}
            </InfoRow>
          </dl>
          {fresh.error ? (
            <p className="mt-2 text-xs text-(--text-3)">সর্বশেষ তথ্য আনা যায়নি: {fresh.error}</p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-(--border) p-4">
          <div>
            <h3 className="text-sm font-semibold text-(--text-1)">পাসওয়ার্ড ও অ্যাকাউন্ট</h3>
            <p className="mt-0.5 text-sm text-(--text-3)">
              পাসওয়ার্ড রিসেট করলে নতুন পাসওয়ার্ড ইমেইলে যাবে এবং ব্যক্তি লগআউট হবেন। মুছে ফেলা
              অ্যাকাউন্ট ফেরত আনা যায় না।
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              icon={<LockIcon className="h-4 w-4" />}
              disabled={busy}
              onClick={() => onResetPassword(account)}
            >
              পাসওয়ার্ড রিসেট
            </Button>
            <Button
              icon={<TrashIcon className="h-4 w-4" />}
              disabled={busy}
              onClick={() => onDelete(account)}
              className="text-(--danger) hover:bg-(--danger-soft)"
            >
              অ্যাকাউন্ট মুছুন
            </Button>
          </div>
        </section>
      </div>
    </Dialog>
  );
}

export function ResetPasswordDialog({
  account,
  onClose,
  onDone,
}: {
  account: StaffView;
  onClose: () => void;
  onDone: (result: PasswordResult) => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState(() => createPassword());
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const error = passwordError(password);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (error) return;
    setBusy(true);
    setServerError(null);
    try {
      const result = await adminApi<{ account: StaffView; email: EmailOutcome }>(
        `/api/admin/staff/${account.id}/password`,
        { method: "POST", body: { password } },
      );
      onDone({ kind: "reset", account: result.account, password, email: result.email });
    } catch (failure) {
      setServerError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title="পাসওয়ার্ড রিসেট"
      description={
        <span className="break-words">
          {account.name} (<span className="break-all">{account.email}</span>)
        </span>
      }
      footer={
        <>
          <Button onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            ফিরে যান
          </Button>
          <Button
            tone="primary"
            type="submit"
            form="staff-reset-form"
            loading={busy}
            className="w-full sm:w-auto"
          >
            রিসেট করে ইমেইল পাঠান
          </Button>
        </>
      }
    >
      <form id="staff-reset-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {serverError ? <Notice tone="danger">{serverError}</Notice> : null}
        <Notice tone="warn">
          রিসেট করলে আগের পাসওয়ার্ড আর কাজ করবে না, ব্যক্তি সব ডিভাইস থেকে লগআউট হবেন এবং নতুন
          পাসওয়ার্ড দিয়ে লগইনের পর নিজের পাসওয়ার্ড দিতে বলা হবে।
        </Notice>
        <Field
          label="নতুন পাসওয়ার্ড"
          error={showErrors ? error : null}
          hint={`অন্তত ${ADMIN_CONFIG.minPasswordChars} অক্ষর। নিজে লিখতে পারেন বা স্বয়ংক্রিয়ভাবে তৈরি করতে পারেন।`}
        >
          {(id) => (
            <PasswordField
              id={id}
              value={password}
              onChange={setPassword}
              disabled={busy}
              onCopyFailed={() => toast.error("কপি করা যায়নি। নিজে বেছে নিয়ে কপি করুন।")}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

function credentialsText(result: PasswordResult): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return [
    `লগইন পাতা: ${origin}${ADMIN_CONFIG.paths.login}`,
    `ইমেইল: ${result.account.email}`,
    `পাসওয়ার্ড: ${result.password}`,
    "প্রথম লগইনের পরপরই অ্যাকাউন্ট পাতায় গিয়ে পাসওয়ার্ড বদলে নিন।",
  ].join("\n");
}

export function PasswordResultDialog({
  result,
  onClose,
}: {
  result: PasswordResult;
  onClose: () => void;
}) {
  const toast = useToast();
  const copyFailed = () => toast.error("কপি করা যায়নি। নিজে বেছে নিয়ে কপি করুন।");

  return (
    <Dialog
      open
      onClose={onClose}
      title={result.kind === "created" ? "অ্যাকাউন্ট তৈরি হয়েছে" : "পাসওয়ার্ড রিসেট হয়েছে"}
      description={
        <span className="break-words">
          {result.account.name} (<span className="break-all">{result.account.email}</span>)
        </span>
      }
      footer={
        <Button tone="primary" onClick={onClose} data-autofocus className="w-full sm:w-auto">
          পাসওয়ার্ড সংরক্ষণ করেছি, বন্ধ করুন
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <EmailOutcomeNotice outcome={result.email} />
        <div className="rounded-xl border border-dashed border-(--accent) bg-(--surface-2) p-4">
          <p className="text-sm font-medium text-(--text-1)">
            {result.kind === "created" ? "অস্থায়ী পাসওয়ার্ড" : "নতুন অস্থায়ী পাসওয়ার্ড"}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <code className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg) px-3 py-2.5 font-mono text-base font-semibold tracking-wide break-all text-(--text-1) select-all">
              {result.password}
            </code>
            <CopyButton text={result.password} label="পাসওয়ার্ড কপি করুন" onFailed={copyFailed} />
          </div>
          <p className="mt-2 text-xs leading-5 text-(--text-3)">
            এই পাসওয়ার্ড আর কখনো দেখানো হবে না। বন্ধ করার আগে কপি করে নিরাপদ মাধ্যমে পৌঁছে দিন।
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-(--border) p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={result.account.role} />
            <Badge>{result.account.categoryName}</Badge>
          </div>
          <p className="text-(--text-2)">
            প্রথম লগইনের পর ব্যক্তিকে পাসওয়ার্ড বদলাতে বলা হবে। লগইন পাতা:{" "}
            <span className="font-mono break-all">{ADMIN_CONFIG.paths.login}</span>
          </p>
          <Button
            size="sm"
            className="self-start"
            onClick={() => {
              void copyText(credentialsText(result)).then((ok) => {
                if (ok) toast.success("লগইনের সব তথ্য কপি হয়েছে।");
                else copyFailed();
              });
            }}
          >
            লগইনের সব তথ্য কপি করুন
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
