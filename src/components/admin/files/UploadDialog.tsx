"use client";

import { useRef, useState, type DragEvent } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { Dialog, useToast } from "@/components/admin/Dialog";
import {
  DELIVERY_OPTIONS,
  FileKindIcon,
  isProtectedPath,
  maxBytesFor,
  ProtectedWarning,
  resourceTypeForFile,
  RESOURCE_OPTIONS,
  type DeliveryType,
  type ResourceType,
  type UsageSummary,
} from "@/components/admin/files/shared";
import { Button, Field, formatSize, IconButton, Input, Select } from "@/components/admin/ui";
import { AlertIcon, CheckIcon, CloseIcon, UploadIcon } from "@/components/ui/Icons";
import type { UploadSignature } from "@/lib/admin/cloudinaryAdmin";

type Status = "waiting" | "uploading" | "done" | "existing" | "failed";

interface QueueItem {
  id: number;
  file: File;
  resourceType: ResourceType;
  status: Status;
  progress: number;
  message: string | null;
  publicId: string | null;
}

interface UploadResult {
  public_id?: string;
  resource_type?: string;
  type?: string;
  bytes?: number;
  existing?: boolean;
  error?: { message?: string };
}

class UploadAbort extends Error {}

function sendFile(
  signature: UploadSignature,
  file: File,
  onProgress: (ratio: number) => void,
  register: (xhr: XMLHttpRequest | null) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("POST", signature.uploadUrl);
    xhr.responseType = "text";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      register(null);
      let payload: UploadResult = {};
      try {
        payload = JSON.parse(xhr.responseText) as UploadResult;
      } catch {
        payload = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
      else
        reject(
          new Error(
            payload.error?.message
              ? `Cloudinary ফাইলটি নেয়নি: ${payload.error.message}`
              : `আপলোড ব্যর্থ হয়েছে (${xhr.status})।`,
          ),
        );
    };
    xhr.onerror = () => {
      register(null);
      reject(new Error("Cloudinary-তে পৌঁছানো যায়নি। ইন্টারনেট সংযোগ দেখুন।"));
    };
    xhr.onabort = () => {
      register(null);
      reject(new UploadAbort("বাতিল করা হয়েছে।"));
    };

    const form = new FormData();
    for (const [key, value] of Object.entries(signature.fields)) form.append(key, value);
    form.append("file", file);
    xhr.send(form);
  });
}

const STATUS_LABEL: Record<Status, string> = {
  waiting: "অপেক্ষমাণ",
  uploading: "আপলোড হচ্ছে",
  done: "সম্পন্ন",
  existing: "আগের ফাইল রাখা হয়েছে",
  failed: "ব্যর্থ",
};

export function UploadDialog({
  open,
  onClose,
  folder,
  defaultType,
  usage,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  folder: string;
  defaultType: DeliveryType;
  usage: UsageSummary | null;
  onUploaded: () => void;
}) {
  const toast = useToast();
  const activeXhr = useRef<XMLHttpRequest | null>(null);
  const cancelled = useRef(false);
  const counter = useRef(0);

  const [target, setTarget] = useState(folder);
  const [type, setType] = useState<DeliveryType>(defaultType);
  const [kind, setKind] = useState<ResourceType | "auto">("auto");
  const [publicId, setPublicId] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [openedWith, setOpenedWith] = useState<{
    open: boolean;
    folder: string;
    type: DeliveryType;
  }>({ open, folder, type: defaultType });

  if (openedWith.open !== open || openedWith.folder !== folder || openedWith.type !== defaultType) {
    setOpenedWith({ open, folder, type: defaultType });
    if (open) {
      setTarget(folder);
      setType(defaultType);
      setKind("auto");
      setPublicId("");
      setOverwrite(false);
      setQueue([]);
    }
  }

  function sizeProblem(file: File, resourceType: ResourceType): string | null {
    const limit = maxBytesFor(resourceType, usage);
    return limit !== null && file.size > limit
      ? `ফাইলটি ${formatSize(file.size)}, কিন্তু এই ধরনের ফাইলের সর্বোচ্চ সীমা ${formatSize(limit)}।`
      : null;
  }

  const pending = queue.filter(
    (item) =>
      (item.status === "waiting" || item.status === "failed") &&
      sizeProblem(item.file, item.resourceType) === null,
  );
  const single = queue.length === 1;
  const protectedTarget = isProtectedPath(target);

  function kindFor(file: File): ResourceType {
    return kind === "auto" ? resourceTypeForFile(file) : kind;
  }

  function addFiles(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;
    setQueue((current) => [
      ...current.filter((item) => item.status !== "done" && item.status !== "existing"),
      ...list.map((file) => {
        counter.current += 1;
        const resourceType = kindFor(file);
        const message = sizeProblem(file, resourceType);
        return {
          id: counter.current,
          file,
          resourceType,
          status: message ? ("failed" as const) : ("waiting" as const),
          progress: 0,
          message,
          publicId: null,
        };
      }),
    ]);
  }

  function changeKind(value: ResourceType | "auto") {
    setKind(value);
    setQueue((current) =>
      current.map((item) => {
        if (item.status !== "waiting" && item.status !== "failed") return item;
        const resourceType = value === "auto" ? resourceTypeForFile(item.file) : value;
        const message = sizeProblem(item.file, resourceType);
        return { ...item, resourceType, status: message ? "failed" : "waiting", message };
      }),
    );
  }

  function update(id: number, patch: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function start() {
    const work = pending;
    if (work.length === 0) return;

    setRunning(true);
    cancelled.current = false;
    const succeeded: {
      publicId: string;
      resourceType: ResourceType;
      type: DeliveryType;
      bytes: number;
      existing: boolean;
    }[] = [];
    let failures = 0;

    for (const item of work) {
      if (cancelled.current) break;
      update(item.id, { status: "uploading", progress: 0, message: null });
      try {
        const signature = await adminApi<UploadSignature>("/api/admin/files/sign", {
          body: {
            folder: target,
            fileName: item.file.name,
            publicId: single && publicId.trim() ? publicId.trim() : null,
            resourceType: item.resourceType,
            type,
            overwrite,
          },
        });
        const result = await sendFile(
          signature,
          item.file,
          (ratio) => update(item.id, { progress: ratio }),
          (xhr) => {
            activeXhr.current = xhr;
          },
        );
        const existing = result.existing === true;
        update(item.id, {
          status: existing ? "existing" : "done",
          progress: 1,
          publicId: result.public_id ?? signature.publicId,
          message: existing
            ? "এই public ID-তে আগে থেকেই ফাইল ছিল, ওভাররাইট বন্ধ থাকায় বদলানো হয়নি।"
            : null,
        });
        succeeded.push({
          publicId: result.public_id ?? signature.publicId,
          resourceType: signature.resourceType,
          type: signature.type,
          bytes: typeof result.bytes === "number" ? result.bytes : item.file.size,
          existing,
        });
      } catch (error) {
        if (error instanceof UploadAbort) {
          update(item.id, { status: "waiting", progress: 0, message: "বাতিল করা হয়েছে।" });
          break;
        }
        failures += 1;
        update(item.id, { status: "failed", message: errorMessage(error) });
      }
    }

    setRunning(false);
    activeXhr.current = null;

    if (succeeded.length > 0) {
      await adminApi("/api/admin/files/uploaded", { body: { items: succeeded } }).catch(
        () => undefined,
      );
      onUploaded();
      const stored = succeeded.filter((item) => !item.existing).length;
      if (stored > 0) toast.success(`${stored}টি ফাইল আপলোড হয়েছে।`);
    }
    if (failures > 0) toast.error(`${failures}টি ফাইল আপলোড করা যায়নি।`);
  }

  function cancel() {
    cancelled.current = true;
    activeXhr.current?.abort();
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!running && event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  }

  const doneCount = queue.filter(
    (item) => item.status === "done" || item.status === "existing",
  ).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={running}
      size="lg"
      title="ফাইল আপলোড"
      description="ফাইল সরাসরি ব্রাউজার থেকে Cloudinary-তে যায়, তাই বড় ফাইলও আপলোড করা যায়।"
      footer={
        <>
          {running ? (
            <Button onClick={cancel} className="w-full sm:w-auto">
              আপলোড থামান
            </Button>
          ) : (
            <Button onClick={onClose} className="w-full sm:w-auto">
              {doneCount > 0 && pending.length === 0 ? "বন্ধ করুন" : "বাতিল"}
            </Button>
          )}
          <Button
            tone="primary"
            onClick={() => void start()}
            loading={running}
            disabled={pending.length === 0}
            icon={<UploadIcon className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            {pending.length > 0 ? `${pending.length}টি ফাইল আপলোড করুন` : "আপলোড করুন"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label
          onDragOver={(event) => {
            event.preventDefault();
            if (!running) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition focus-within:ring-2 focus-within:ring-(--accent-soft)",
            dragging
              ? "border-(--accent) bg-(--accent-soft)"
              : "border-(--border) bg-(--surface-2) hover:border-(--accent)",
            running && "pointer-events-none opacity-60",
          )}
        >
          <UploadIcon className="h-7 w-7 text-(--accent)" />
          <span className="text-sm font-medium text-(--text-1)">
            ফাইল এখানে টেনে আনুন, অথবা ট্যাপ করে বেছে নিন
          </span>
          <span className="text-xs text-(--text-3)">একসাথে একাধিক ফাইল বেছে নেওয়া যায়</span>
          <input
            type="file"
            multiple
            disabled={running}
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="লক্ষ্য ফোল্ডার"
            hint="খালি রাখলে মূল ফোল্ডারে যাবে। নতুন পথ দিলে ফোল্ডার তৈরি হবে।"
          >
            {(id) => (
              <Input
                id={id}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="যেমন: uploads/2026"
                disabled={running}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
          <Field
            label="ডেলিভারি ধরন"
            hint={DELIVERY_OPTIONS.find((option) => option.value === type)?.hint}
          >
            {(id) => (
              <Select
                id={id}
                value={type}
                onChange={(event) => setType(event.target.value as DeliveryType)}
                disabled={running}
              >
                {DELIVERY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="ফাইলের ধরন"
            hint="স্বয়ংক্রিয়: ছবি image, ভিডিও ও অডিও video, বাকি সব raw।"
          >
            {(id) => (
              <Select
                id={id}
                value={kind}
                onChange={(event) => changeKind(event.target.value as ResourceType | "auto")}
                disabled={running}
              >
                <option value="auto">স্বয়ংক্রিয়</option>
                {RESOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="public ID (ঐচ্ছিক)"
            hint={
              single
                ? "খালি রাখলে ফাইলের নাম থেকে তৈরি হবে।"
                : "একটি ফাইল বেছে নিলে নিজের public ID দেওয়া যায়।"
            }
          >
            {(id) => (
              <Input
                id={id}
                value={publicId}
                onChange={(event) => setPublicId(event.target.value)}
                placeholder="যেমন: book-name"
                disabled={running || !single}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
        </div>

        <label className="flex min-h-10 cursor-pointer items-start gap-3 text-sm text-(--text-1)">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(event) => setOverwrite(event.target.checked)}
            disabled={running}
            className="mt-0.5 h-5 w-5 shrink-0 accent-(--accent)"
          />
          <span>
            একই public ID-তে ফাইল থাকলে বদলে দিন (ওভাররাইট)
            <span className="block text-xs text-(--text-3)">
              বন্ধ থাকলে আগের ফাইল অক্ষত থাকবে এবং নতুনটি বাদ যাবে।
            </span>
          </span>
        </label>

        {protectedTarget ? <ProtectedWarning /> : null}

        {queue.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="আপলোডের তালিকা">
            {queue.map((item) => (
              <li key={item.id} className="rounded-xl border border-(--border) px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <FileKindIcon
                    resourceType={item.resourceType}
                    type={type}
                    className="h-5 w-5 shrink-0 text-(--text-3)"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-(--text-1)" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <p className="text-xs text-(--text-3)">
                      {formatSize(item.file.size)}, {item.resourceType}, {STATUS_LABEL[item.status]}
                      {item.status === "uploading"
                        ? ` ${Math.round(item.progress * 100).toLocaleString("bn-BD")}%`
                        : ""}
                    </p>
                  </div>
                  {item.status === "done" || item.status === "existing" ? (
                    <CheckIcon className="h-5 w-5 shrink-0 text-(--accent)" />
                  ) : item.status === "failed" ? (
                    <AlertIcon className="h-5 w-5 shrink-0 text-(--danger)" />
                  ) : null}
                  {!running && item.status !== "uploading" ? (
                    <IconButton
                      label={`${item.file.name} তালিকা থেকে সরান`}
                      onClick={() =>
                        setQueue((current) => current.filter((entry) => entry.id !== item.id))
                      }
                    >
                      <CloseIcon className="h-4 w-4" />
                    </IconButton>
                  ) : null}
                </div>
                {item.status === "uploading" || item.status === "done" ? (
                  <div
                    role="progressbar"
                    aria-label={`${item.file.name} আপলোডের অগ্রগতি`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress * 100)}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--surface-3)"
                  >
                    <div
                      className="h-full rounded-full bg-(--accent) transition-[width]"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                ) : null}
                {item.publicId ? (
                  <p className="mt-1 text-xs break-all text-(--text-3)">
                    public ID: {item.publicId}
                  </p>
                ) : null}
                {item.message ? (
                  <p
                    className={clsx(
                      "mt-1 text-xs break-words",
                      item.status === "failed" ? "text-(--danger)" : "text-(--text-3)",
                    )}
                  >
                    {item.message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Dialog>
  );
}
