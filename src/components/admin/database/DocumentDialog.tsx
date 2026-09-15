"use client";

import { useState } from "react";
import { adminApi, errorMessage, AdminApiError } from "@/components/admin/api";
import { Dialog, useToast } from "@/components/admin/Dialog";
import { Badge, Button, LoadError, Notice, Skeleton, formatSize } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { JsonEditor, jsonEditorIsValid } from "@/components/admin/database/JsonEditor";
import { documentApiPath } from "@/components/admin/database/jsonText";
import { CheckIcon, CopyIcon, PenIcon, RetryIcon, TrashIcon } from "@/components/ui/Icons";

export interface DocumentPayload {
  id: string;
  text: string;
  binaries: { path: string; subtype: number; bytes: number }[];
  bytes: number;
  revision: string;
}

type Mode = "view" | "edit" | "delete";

export function DocumentDialog({
  collection,
  documentId,
  onClose,
  onChanged,
}: {
  collection: string;
  documentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const path = documentApiPath(collection, documentId);
  const { data, error, loading, reload, replace } = useAdminData<DocumentPayload>(path);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<{ message: string; conflict: boolean } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const startEdit = () => {
    if (!data) return;
    setDraft(data.text);
    setActionError(null);
    setMode("edit");
  };

  const copy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("কপি করা যায়নি।"),
    );
  };

  const save = async () => {
    if (!data) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await adminApi<{ document: DocumentPayload | null; changed: string[] }>(path, {
        method: "PUT",
        body: { document: draft, revision: data.revision },
      });
      if (result.document) replace(result.document);
      setMode("view");
      toast.success(
        result.changed.length > 0
          ? `নথি সংরক্ষিত হয়েছে। বদলানো ফিল্ড: ${result.changed.join(", ")}`
          : "নথি সংরক্ষিত হয়েছে, কোনো ফিল্ড বদলায়নি।",
      );
      onChanged();
    } catch (failure) {
      setActionError({
        message: errorMessage(failure),
        conflict: failure instanceof AdminApiError && failure.status === 409,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await adminApi(path, { method: "DELETE" });
      toast.success("নথি মুছে ফেলা হয়েছে।");
      onChanged();
      onClose();
    } catch (failure) {
      setActionError({ message: errorMessage(failure), conflict: false });
      setBusy(false);
    }
  };

  const reloadLatest = () => {
    setActionError(null);
    setMode("view");
    reload();
  };

  const hasPlaceholders = (data?.binaries.length ?? 0) > 0;

  const footer =
    !data || error ? (
      <Button onClick={onClose} className="w-full sm:w-auto">
        বন্ধ করুন
      </Button>
    ) : mode === "edit" ? (
      <>
        <Button onClick={() => setMode("view")} disabled={busy} className="w-full sm:w-auto">
          বাতিল
        </Button>
        <Button
          tone="primary"
          onClick={() => void save()}
          loading={busy}
          disabled={!jsonEditorIsValid(draft)}
          className="w-full sm:w-auto"
        >
          সংরক্ষণ
        </Button>
      </>
    ) : mode === "delete" ? (
      <>
        <Button onClick={() => setMode("view")} disabled={busy} className="w-full sm:w-auto">
          বাতিল
        </Button>
        <Button
          tone="danger"
          onClick={() => void remove()}
          loading={busy}
          data-autofocus
          icon={<TrashIcon className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          স্থায়ীভাবে মুছুন
        </Button>
      </>
    ) : (
      <>
        <Button
          tone="danger"
          onClick={() => {
            setActionError(null);
            setMode("delete");
          }}
          icon={<TrashIcon className="h-4 w-4" />}
          className="w-full sm:me-auto sm:w-auto"
        >
          মুছুন
        </Button>
        <Button
          onClick={copy}
          icon={copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          {copied ? "কপি হয়েছে" : "কপি"}
        </Button>
        <Button
          tone="primary"
          onClick={startEdit}
          icon={<PenIcon className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          সম্পাদনা
        </Button>
      </>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      busy={busy}
      title={mode === "edit" ? "নথি সম্পাদনা" : mode === "delete" ? "নথি মুছবেন?" : "নথি"}
      description={
        <span className="font-mono text-xs break-all" dir="ltr">
          {collection} / {documentId}
        </span>
      }
      footer={footer}
    >
      <div className="flex min-w-0 flex-col gap-3">
        {error ? <LoadError message={error} onRetry={reload} /> : null}
        {actionError ? (
          <Notice
            tone="danger"
            action={
              actionError.conflict ? (
                <Button size="sm" onClick={reloadLatest} icon={<RetryIcon className="h-4 w-4" />}>
                  সর্বশেষটি খুলুন
                </Button>
              ) : undefined
            }
          >
            {actionError.message}
          </Notice>
        ) : null}

        {!data && loading ? <Skeleton rows={5} /> : null}

        {data ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-(--text-3)">
              <Badge>{formatSize(data.bytes)}</Badge>
              {data.binaries.map((binary) => (
                <Badge key={binary.path} tone="accent">
                  <span dir="ltr" className="font-mono">
                    {binary.path || "/"} Binary {binary.subtype}, {formatSize(binary.bytes)}
                  </span>
                </Badge>
              ))}
            </div>

            {mode === "delete" ? (
              <Notice tone="danger">
                এই নথিটি স্থায়ীভাবে মুছে যাবে, ফেরত আনা যাবে না। কাজটি অডিট লগে লেখা থাকবে।
              </Notice>
            ) : null}

            {mode === "edit" ? (
              <>
                {hasPlaceholders ? (
                  <Notice>
                    Binary ফিল্ডগুলো {'{"$binaryRef": "/path"}'} আকারে দেখানো হয়েছে। এগুলো না
                    বদলালে সংরক্ষণের সময় মূল Binary অক্ষত থাকবে। নতুন মান দিতে পুরো অবজেক্টটি{" "}
                    {'{"$binary": {"base64": "...", "subType": "00"}}'} দিয়ে বদলান।
                  </Notice>
                ) : null}
                <JsonEditor
                  label="নথির Extended JSON"
                  value={draft}
                  onChange={setDraft}
                  disabled={busy}
                  minRows={18}
                />
                <p className="text-xs leading-5 text-(--text-3)">
                  _id বদলানো যায় না। ObjectId, Date ও Long যথাক্রমে {'{"$oid"}'}, {'{"$date"}'} ও{" "}
                  {'{"$numberLong"}'} আকারে লিখুন।
                </p>
              </>
            ) : (
              <pre
                dir="ltr"
                className="thin-scroll max-h-[60dvh] overflow-auto rounded-xl bg-(--surface-2) px-3 py-2.5 font-mono text-[13px] leading-5 whitespace-pre text-(--text-1)"
              >
                {data.text}
              </pre>
            )}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
