"use client";

import { useCallback, useState, type FormEvent } from "react";
import { clsx } from "clsx";
import { STAFF_CONFIG } from "@/config/site";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, Dialog, useToast } from "@/components/admin/Dialog";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadError,
  Notice,
  Skeleton,
  Textarea,
  formatCount,
} from "@/components/admin/ui";
import { ArrowDownIcon, ArrowUpIcon, PenIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import { ROLE_LABELS, type StaffRole } from "@/lib/admin/roles";
import {
  CORE_DATA_NOTE,
  ROLE_SUMMARIES,
  RoleBadge,
  type CategoryView,
} from "@/components/admin/staff/shared";

const DESCRIPTION_CHARS = 300;

type Panel =
  | { kind: "create" }
  | { kind: "edit"; category: CategoryView }
  | { kind: "delete"; category: CategoryView };

function RoleChoice({
  value,
  onChange,
  disabled,
}: {
  value: StaffRole;
  onChange: (role: StaffRole) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-(--text-1)">ভূমিকা</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["scholar", "moderator"] as const).map((role) => {
          const summary = ROLE_SUMMARIES[role];
          const checked = value === role;
          return (
            <label
              key={role}
              className={clsx(
                "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition",
                checked
                  ? "border-(--accent) bg-(--accent-soft)"
                  : "border-(--border) hover:bg-(--surface-2)",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="category-role"
                  value={role}
                  checked={checked}
                  onChange={() => onChange(role)}
                  className="h-4 w-4 accent-(--accent)"
                />
                <span className="text-sm font-semibold text-(--text-1)">{ROLE_LABELS[role]}</span>
              </span>
              <span className="text-xs text-(--text-2)">{summary.title}</span>
              <ul className="list-disc ps-5 text-xs leading-5 text-(--text-3)">
                {summary.abilities.map((ability) => (
                  <li key={ability}>{ability}</li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: CategoryView | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [role, setRole] = useState<StaffRole>(category?.role ?? "scholar");
  const [description, setDescription] = useState(category?.description ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmed = name.trim();
  const nameProblem = !trimmed
    ? "ক্যাটাগরির নাম দিন।"
    : trimmed.length > STAFF_CONFIG.maxCategoryNameChars
      ? `নাম ${STAFF_CONFIG.maxCategoryNameChars} অক্ষরের বেশি হতে পারবে না।`
      : null;
  const descriptionProblem =
    description.trim().length > DESCRIPTION_CHARS
      ? `বিবরণ ${DESCRIPTION_CHARS} অক্ষরের বেশি হতে পারবে না।`
      : null;
  const roleChanged = category !== null && category.role !== role;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (nameProblem || descriptionProblem) return;
    setBusy(true);
    setServerError(null);
    try {
      if (category) {
        const result = await adminApi<{ roleChanged: boolean; signedOut: number }>(
          `/api/admin/staff/categories/${category.id}`,
          { method: "PATCH", body: { name: trimmed, role, description: description.trim() } },
        );
        onSaved(
          result.roleChanged
            ? `ক্যাটাগরি হালনাগাদ হয়েছে। ${formatCount(result.signedOut)}টি অ্যাকাউন্ট লগআউট করা হয়েছে।`
            : "ক্যাটাগরি হালনাগাদ হয়েছে।",
        );
      } else {
        await adminApi(`/api/admin/staff/categories`, {
          method: "POST",
          body: { name: trimmed, role, description: description.trim() },
        });
        onSaved(`"${trimmed}" ক্যাটাগরি তৈরি হয়েছে।`);
      }
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
      title={category ? "ক্যাটাগরি সম্পাদনা" : "নতুন ক্যাটাগরি"}
      description="ক্যাটাগরির নাম অ্যাকাউন্ট তৈরির ড্রপডাউনে দেখা যায়; ভূমিকা ঠিক করে কে কী করতে পারবেন।"
      footer={
        <>
          <Button onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            বাতিল
          </Button>
          <Button
            tone="primary"
            type="submit"
            form="staff-category-form"
            loading={busy}
            className="w-full sm:w-auto"
          >
            {category ? "সংরক্ষণ করুন" : "ক্যাটাগরি তৈরি করুন"}
          </Button>
        </>
      }
    >
      <form id="staff-category-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {serverError ? <Notice tone="danger">{serverError}</Notice> : null}
        <Field label="নাম" error={showErrors ? nameProblem : null}>
          {(id) => (
            <Input
              id={id}
              value={name}
              maxLength={STAFF_CONFIG.maxCategoryNameChars}
              autoComplete="off"
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <RoleChoice value={role} onChange={setRole} disabled={busy} />
        {roleChanged ? (
          <Notice tone="warn">
            ভূমিকা বদলালে এই ক্যাটাগরির{" "}
            {category.accounts > 0 ? `${formatCount(category.accounts)}টি ` : ""}অ্যাকাউন্ট সব
            ডিভাইস থেকে সঙ্গে সঙ্গে লগআউট হবে এবং আবার লগইন করলে {ROLE_LABELS[role]} ভূমিকার অনুমতি
            পাবে।
          </Notice>
        ) : null}
        <Field
          label="বিবরণ (ঐচ্ছিক)"
          error={showErrors ? descriptionProblem : null}
          hint={`${formatCount(description.trim().length)}/${formatCount(DESCRIPTION_CHARS)} অক্ষর`}
        >
          {(id) => (
            <Textarea
              id={id}
              value={description}
              maxLength={DESCRIPTION_CHARS}
              rows={3}
              disabled={busy}
              onChange={(event) => setDescription(event.target.value)}
            />
          )}
        </Field>
        <p className="text-xs leading-5 text-(--text-3)">{CORE_DATA_NOTE}</p>
      </form>
    </Dialog>
  );
}

export function CategoriesTab({
  categories,
  error,
  loading,
  onReload,
  onReplace,
}: {
  categories: readonly CategoryView[] | null;
  error: string | null;
  loading: boolean;
  onReload: () => void;
  onReplace: (items: CategoryView[]) => void;
}) {
  const toast = useToast();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const close = useCallback(() => setPanel(null), []);

  async function move(index: number, delta: number) {
    if (!categories) return;
    const target = index + delta;
    const moved = categories[index];
    const other = categories[target];
    if (!moved || !other) return;
    const next = [...categories];
    next[index] = other;
    next[target] = moved;
    setMoving(true);
    onReplace(next);
    try {
      const result = await adminApi<{ items: CategoryView[] }>(
        "/api/admin/staff/categories/reorder",
        { method: "POST", body: { ids: next.map((category) => category.id) } },
      );
      onReplace(result.items);
    } catch (failure) {
      toast.error(errorMessage(failure));
      onReload();
    } finally {
      setMoving(false);
    }
  }

  async function confirmDelete(category: CategoryView) {
    setDeleting(true);
    try {
      await adminApi(`/api/admin/staff/categories/${category.id}`, { method: "DELETE" });
      toast.success(`"${category.name}" ক্যাটাগরি মুছে ফেলা হয়েছে।`);
      setPanel(null);
      onReload();
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setDeleting(false);
    }
  }

  const pendingDelete = panel?.kind === "delete" ? panel.category : null;
  const blocked = pendingDelete !== null && pendingDelete.accounts > 0;

  return (
    <>
      <Card
        padded={false}
        title="ক্যাটাগরি"
        description="অ্যাকাউন্ট তৈরির সময় এই তালিকা থেকে ক্যাটাগরি বেছে নেওয়া হয়। ওপরে-নিচে সরিয়ে ড্রপডাউনের ক্রম ঠিক করুন।"
        actions={
          <Button
            tone="primary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => setPanel({ kind: "create" })}
          >
            নতুন ক্যাটাগরি
          </Button>
        }
      >
        <div className="p-3 sm:p-4" aria-busy={loading || moving}>
          {!categories && error ? (
            <LoadError message={error} onRetry={onReload} />
          ) : !categories ? (
            <Skeleton rows={6} />
          ) : categories.length === 0 ? (
            <EmptyState title="কোনো ক্যাটাগরি নেই">
              অ্যাকাউন্ট তৈরির আগে অন্তত একটি ক্যাটাগরি যোগ করুন।
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {categories.map((category, index) => (
                <li
                  key={category.id}
                  className="flex flex-col gap-3 rounded-xl border border-(--border) p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium break-words text-(--text-1)">
                        {category.name}
                      </span>
                      <RoleBadge role={category.role} />
                      {category.system ? <Badge>ডিফল্ট</Badge> : null}
                    </div>
                    {category.description ? (
                      <p className="mt-1 text-sm break-words text-(--text-2)">
                        {category.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-(--text-3) tabular-nums">
                      {category.accounts > 0
                        ? `${formatCount(category.accounts)}টি অ্যাকাউন্ট`
                        : "কোনো অ্যাকাউন্ট নেই"}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1 border-t border-(--border) pt-2 sm:border-t-0 sm:pt-0">
                    <IconButton
                      label="ওপরে সরান"
                      disabled={moving || index === 0}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="নিচে সরান"
                      disabled={moving || index === categories.length - 1}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="সম্পাদনা"
                      onClick={() => setPanel({ kind: "edit", category })}
                    >
                      <PenIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="মুছুন"
                      onClick={() => setPanel({ kind: "delete", category })}
                      className="hover:text-(--danger)"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {panel?.kind === "create" || panel?.kind === "edit" ? (
        <CategoryDialog
          key={panel.kind === "edit" ? panel.category.id : "new"}
          category={panel.kind === "edit" ? panel.category : null}
          onClose={close}
          onSaved={(message) => {
            toast.success(message);
            setPanel(null);
            onReload();
          }}
        />
      ) : null}

      <Dialog
        open={blocked}
        onClose={close}
        title="ক্যাটাগরিটি মুছে ফেলা যাবে না"
        footer={
          <Button tone="primary" onClick={close} data-autofocus className="w-full sm:w-auto">
            ঠিক আছে
          </Button>
        }
      >
        <p className="text-sm leading-6 text-(--text-2)">
          &quot;{pendingDelete?.name}&quot; ক্যাটাগরিতে এখন{" "}
          {formatCount(pendingDelete?.accounts ?? 0)}টি অ্যাকাউন্ট আছে। আগে অ্যাকাউন্ট ট্যাব থেকে
          সেগুলোকে অন্য ক্যাটাগরিতে সরান বা মুছে ফেলুন, তারপর ক্যাটাগরিটি মুছতে পারবেন।
        </p>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null && !blocked}
        title="ক্যাটাগরিটি মুছে ফেলবেন?"
        message={
          <>
            <span className="block font-medium break-words text-(--text-1)">
              {pendingDelete?.name}
            </span>
            <span className="mt-2 block">
              ক্যাটাগরিটি ড্রপডাউন থেকে স্থায়ীভাবে সরে যাবে। এটি ফেরত আনা যাবে না
              {pendingDelete?.system ? "; ডিফল্ট ক্যাটাগরিও আবার নিজে থেকে তৈরি হবে না" : ""}।
            </span>
          </>
        }
        confirmLabel="মুছে ফেলুন"
        busy={deleting}
        onClose={close}
        onConfirm={() => {
          if (pendingDelete) void confirmDelete(pendingDelete);
        }}
      />
    </>
  );
}
