"use client";

import { useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { Dialog, useToast } from "@/components/admin/Dialog";
import { Button, Field, Input, Notice, formatCount } from "@/components/admin/ui";
import { TrashIcon } from "@/components/ui/Icons";

export function BulkDeleteDialog({
  collection,
  filter,
  total,
  totalCapped,
  guarded,
  onClose,
  onDeleted,
}: {
  collection: string;
  filter: string;
  total: number | null;
  totalCapped: boolean;
  guarded: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [confirmName, setConfirmName] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emptyFilter = filter.trim() === "" || filter.trim() === "{}";
  const ready = confirmName === collection && (!emptyFilter || confirmAll);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi<{ deletedCount: number }>(
        `/api/admin/database/${encodeURIComponent(collection)}`,
        {
          method: "DELETE",
          body: { filter, confirmName, ...(emptyFilter ? { confirmAll } : {}) },
        },
      );
      toast.success(`${formatCount(result.deletedCount)}টি নথি মুছে ফেলা হয়েছে।`);
      onDeleted();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  const countLabel =
    total === null ? "অজানা সংখ্যক" : `${formatCount(total)}${totalCapped ? "+" : ""}টি`;

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title="ফিল্টার অনুযায়ী মুছুন"
      footer={
        <>
          <Button onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            বাতিল
          </Button>
          <Button
            tone="danger"
            onClick={() => void submit()}
            loading={busy}
            disabled={!ready}
            icon={<TrashIcon className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            স্থায়ীভাবে মুছুন
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Notice tone="danger">
          {emptyFilter
            ? `কোনো ফিল্টার নেই, তাই কালেকশনের সব (${countLabel}) নথি মুছে যাবে।`
            : `এই ফিল্টারের সাথে মেলে এমন ${countLabel} নথি মুছে যাবে।`}{" "}
          ফেরত আনা যাবে না।
          {guarded ? " এই কালেকশনটি অ্যাপের জন্য অত্যন্ত গুরুত্বপূর্ণ।" : ""}
        </Notice>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-(--text-1)">ফিল্টার</span>
          <pre
            dir="ltr"
            className="thin-scroll max-h-40 overflow-auto rounded-xl bg-(--surface-2) px-3 py-2 font-mono text-xs leading-5 whitespace-pre text-(--text-1)"
          >
            {emptyFilter ? "{}" : filter}
          </pre>
        </div>
        {emptyFilter ? (
          <label className="flex min-h-10 cursor-pointer items-start gap-3 text-sm text-(--text-1)">
            <input
              type="checkbox"
              checked={confirmAll}
              onChange={(event) => setConfirmAll(event.target.checked)}
              disabled={busy}
              className="mt-0.5 h-5 w-5 shrink-0 accent-(--danger)"
            />
            আমি জানি যে এই কালেকশনের সব নথি মুছে যাবে।
          </label>
        ) : null}
        <Field label="নিশ্চিত করতে কালেকশনের নাম লিখুন" hint={collection}>
          {(id) => (
            <Input
              id={id}
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              dir="ltr"
              disabled={busy}
              placeholder={collection}
              className="font-mono"
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
