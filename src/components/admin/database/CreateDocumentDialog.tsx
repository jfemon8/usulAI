"use client";

import { useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { Dialog, useToast } from "@/components/admin/Dialog";
import { Button, Notice } from "@/components/admin/ui";
import { JsonEditor, jsonEditorIsValid } from "@/components/admin/database/JsonEditor";

const TEMPLATE = '{\n  "name": "..."\n}\n';

export function CreateDocumentDialog({
  collection,
  onClose,
  onCreated,
}: {
  collection: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState(TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi<{ id: string }>(
        `/api/admin/database/${encodeURIComponent(collection)}`,
        { method: "POST", body: { document: text } },
      );
      toast.success("নতুন নথি তৈরি হয়েছে।");
      onCreated(result.id);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      busy={busy}
      title="নতুন নথি"
      description={
        <span>
          <span className="font-mono" dir="ltr">
            {collection}
          </span>{" "}
          কালেকশনে Extended JSON লিখে নথি যোগ করুন।
        </span>
      }
      footer={
        <>
          <Button onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            বাতিল
          </Button>
          <Button
            tone="primary"
            onClick={() => void submit()}
            loading={busy}
            disabled={!jsonEditorIsValid(text)}
            className="w-full sm:w-auto"
          >
            তৈরি করুন
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <JsonEditor
          label="নতুন নথির Extended JSON"
          value={text}
          onChange={setText}
          disabled={busy}
        />
        <p className="text-xs leading-5 text-(--text-3)">
          _id না দিলে MongoDB নিজেই একটি ObjectId দেবে। তারিখ {'{"$date": "2026-01-01T00:00:00Z"}'}{" "}
          এবং ObjectId {'{"$oid": "..."}'} আকারে লিখুন।
        </p>
      </div>
    </Dialog>
  );
}
