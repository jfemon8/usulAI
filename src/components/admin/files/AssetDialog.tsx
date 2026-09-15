"use client";

import Image from "next/image";
import { useCallback, useState, type ReactNode } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, Dialog, useToast } from "@/components/admin/Dialog";
import {
  DELIVERY_OPTIONS,
  deliveryLabel,
  FileKindIcon,
  isProtectedPath,
  ProtectedWarning,
  resourceLabel,
  type AssetDetails,
  type AssetSummary,
  type DeliveryType,
} from "@/components/admin/files/shared";
import { useAdminData } from "@/components/admin/useAdminData";
import {
  Badge,
  Button,
  Field,
  formatCount,
  formatSize,
  formatWhen,
  Input,
  Notice,
  Select,
} from "@/components/admin/ui";
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  PenIcon,
  TrashIcon,
} from "@/components/ui/Icons";

type Pending =
  | { kind: "rename"; toPublicId: string; toType: DeliveryType; overwrite: boolean }
  | { kind: "delete" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-(--border) pt-4">
      <h3 className="text-sm font-semibold text-(--text-1)">{title}</h3>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-(--text-3)">{label}</dt>
      <dd className="min-w-0 break-all text-(--text-1)">{children}</dd>
    </div>
  );
}

export function AssetDialog({
  asset,
  onClose,
  onChanged,
}: {
  asset: AssetSummary | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const detailsPath = asset
    ? `/api/admin/files/asset?${new URLSearchParams({
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        type: asset.type,
      })}`
    : null;
  const { data, error, loading, reload, replace } = useAdminData<{ asset: AssetDetails }>(
    detailsPath,
  );
  const details = data?.asset ?? null;
  const current: AssetSummary | null = details ?? asset;

  const [toPublicId, setToPublicId] = useState(asset?.publicId ?? "");
  const [toType, setToType] = useState<DeliveryType>(asset?.type ?? "upload");
  const [overwrite, setOverwrite] = useState(false);
  const [tags, setTags] = useState(asset?.tags.join(", ") ?? "");
  const [tagsSeen, setTagsSeen] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<"rename" | "tags" | "delete" | "open" | "download" | null>(null);

  const closeConfirm = useCallback(() => setPending(null), []);

  const loadedTags = details ? details.tags.join(", ") : null;
  if (loadedTags !== null && loadedTags !== tagsSeen) {
    setTagsSeen(loadedTags);
    setTags(loadedTags);
  }

  if (!asset || !current) return null;

  const ref = {
    publicId: current.publicId,
    resourceType: current.resourceType,
    type: current.type,
  };
  const protectedAsset = isProtectedPath(current.publicId);
  const renameChanged = toPublicId.trim() !== current.publicId || toType !== current.type;

  async function fetchUrl(download: boolean) {
    if (!current) return;
    setBusy(download ? "download" : "open");
    const tab = download ? null : window.open("", "_blank");
    try {
      const result = await adminApi<{ url: string }>("/api/admin/files/url", {
        body: { ...ref, format: current.format, download },
      });
      if (download) {
        window.location.assign(result.url);
      } else if (tab) {
        tab.opener = null;
        tab.location.href = result.url;
      } else {
        window.location.assign(result.url);
      }
    } catch (failure) {
      tab?.close();
      toast.error(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    if (!current?.secureUrl) return;
    try {
      await navigator.clipboard.writeText(current.secureUrl);
      toast.success("লিংক কপি হয়েছে।");
    } catch {
      toast.error("লিংক কপি করা যায়নি।");
    }
  }

  async function rename(request: Extract<Pending, { kind: "rename" }>) {
    setBusy("rename");
    try {
      const result = await adminApi<{ asset: AssetDetails }>("/api/admin/files/asset", {
        method: "PATCH",
        body: {
          ...ref,
          toPublicId: request.toPublicId,
          toType: request.toType,
          overwrite: request.overwrite,
        },
      });
      toast.success(`ফাইলটি এখন ${result.asset.publicId} নামে আছে।`);
      setPending(null);
      onChanged();
      onClose();
    } catch (failure) {
      setPending(null);
      toast.error(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  function requestRename() {
    const request = {
      kind: "rename" as const,
      toPublicId: toPublicId.trim(),
      toType,
      overwrite,
    };
    if (protectedAsset || isProtectedPath(request.toPublicId)) setPending(request);
    else void rename(request);
  }

  async function saveTags() {
    setBusy("tags");
    try {
      const result = await adminApi<{ asset: AssetDetails }>("/api/admin/files/asset", {
        method: "PATCH",
        body: {
          ...ref,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
      });
      replace(result);
      toast.success("ট্যাগ সংরক্ষণ হয়েছে।");
      onChanged();
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      const result = await adminApi<{ deleted: string[]; notFound: string[] }>("/api/admin/files", {
        method: "DELETE",
        body: { items: [ref] },
      });
      setPending(null);
      if (result.deleted.length > 0) toast.success("ফাইলটি মুছে ফেলা হয়েছে।");
      else toast.error("ফাইলটি পাওয়া যায়নি, হয়তো আগেই মুছে ফেলা হয়েছে।");
      onChanged();
      onClose();
    } catch (failure) {
      setPending(null);
      toast.error(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  const preview = details?.previewUrl ?? current.thumbnailUrl;

  return (
    <>
      <Dialog
        open={pending === null}
        onClose={onClose}
        size="lg"
        busy={busy === "rename" || busy === "tags" || busy === "delete"}
        title={current.name}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge>{resourceLabel(current.resourceType)}</Badge>
            <Badge tone={current.type === "upload" ? "accent" : "warn"}>
              {deliveryLabel(current.type)}
            </Badge>
            {protectedAsset ? <Badge tone="danger">অ্যাপের উৎস ফাইল</Badge> : null}
          </span>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-(--surface-2) sm:h-72">
            {preview ? (
              <Image
                src={preview}
                alt={current.name}
                fill
                unoptimized
                sizes="(min-width: 640px) 40rem, 100vw"
                className="object-contain"
              />
            ) : (
              <FileKindIcon
                resourceType={current.resourceType}
                type={current.type}
                className="h-16 w-16 text-(--text-3)"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            {current.type === "upload" && current.secureUrl ? (
              <a
                href={current.secureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-(--border) bg-(--bg) px-4 text-sm font-medium text-(--text-1) transition hover:bg-(--surface-2)"
              >
                <ExternalLinkIcon className="h-4 w-4" />
                খুলুন
              </a>
            ) : (
              <Button
                onClick={() => void fetchUrl(false)}
                loading={busy === "open"}
                icon={<ExternalLinkIcon className="h-4 w-4" />}
              >
                সাইন করা লিংকে খুলুন
              </Button>
            )}
            <Button
              onClick={() => void fetchUrl(true)}
              loading={busy === "download"}
              icon={<DownloadIcon className="h-4 w-4" />}
            >
              ডাউনলোড
            </Button>
            {current.secureUrl ? (
              <Button onClick={() => void copyLink()} icon={<CopyIcon className="h-4 w-4" />}>
                পাবলিক লিংক কপি
              </Button>
            ) : null}
          </div>

          {error ? (
            <Notice
              tone="danger"
              action={
                <Button size="sm" onClick={reload}>
                  আবার চেষ্টা
                </Button>
              }
            >
              {error}
            </Notice>
          ) : null}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <Detail label="public ID">{current.publicId}</Detail>
            <Detail label="ফোল্ডার">{current.folder || "মূল ফোল্ডার"}</Detail>
            <Detail label="ফরম্যাট">{current.format ?? "নেই"}</Detail>
            <Detail label="আকার">{formatSize(current.bytes)}</Detail>
            {current.width !== null && current.height !== null ? (
              <Detail label="মাপ">
                {formatCount(current.width)} x {formatCount(current.height)} px
              </Detail>
            ) : null}
            {details?.pages ? <Detail label="পাতা">{formatCount(details.pages)}</Detail> : null}
            {details?.duration ? (
              <Detail label="দৈর্ঘ্য">{formatCount(Math.round(details.duration))} সেকেন্ড</Detail>
            ) : null}
            <Detail label="তৈরি">{formatWhen(current.createdAt)}</Detail>
            {details?.assetFolder ? (
              <Detail label="asset folder">{details.assetFolder}</Detail>
            ) : null}
            {details?.accessMode ? <Detail label="access mode">{details.accessMode}</Detail> : null}
            <Detail label="ট্যাগ">
              {current.tags.length > 0 ? current.tags.join(", ") : loading ? "লোড হচ্ছে" : "নেই"}
            </Detail>
            {current.secureUrl ? <Detail label="URL">{current.secureUrl}</Detail> : null}
          </dl>

          <Section title="ট্যাগ">
            <Field
              label="ট্যাগগুলো"
              hint="কমা দিয়ে আলাদা করুন। সব মুছে সংরক্ষণ করলে ট্যাগ খালি হবে।"
            >
              {(id) => (
                <Input
                  id={id}
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="যেমন: book, ijma"
                  autoComplete="off"
                  disabled={busy !== null || loading}
                />
              )}
            </Field>
            <div className="flex justify-end">
              <Button
                onClick={() => void saveTags()}
                loading={busy === "tags"}
                disabled={loading || busy !== null || tags === (loadedTags ?? tags)}
                className="w-full sm:w-auto"
              >
                ট্যাগ সংরক্ষণ
              </Button>
            </div>
          </Section>

          <Section title="নাম বদল, সরানো বা ডেলিভারি ধরন">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="নতুন public ID"
                hint="ফোল্ডার বদলাতে পথসহ লিখুন, যেমন folder/sub/name।"
                className="sm:col-span-2"
              >
                {(id) => (
                  <Input
                    id={id}
                    value={toPublicId}
                    onChange={(event) => setToPublicId(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy !== null}
                  />
                )}
              </Field>
              <Field
                label="ডেলিভারি ধরন"
                hint={DELIVERY_OPTIONS.find((option) => option.value === toType)?.hint}
              >
                {(id) => (
                  <Select
                    id={id}
                    value={toType}
                    onChange={(event) => setToType(event.target.value as DeliveryType)}
                    disabled={busy !== null}
                  >
                    {DELIVERY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 self-end text-sm text-(--text-1)">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(event) => setOverwrite(event.target.checked)}
                  disabled={busy !== null}
                  className="h-5 w-5 shrink-0 accent-(--accent)"
                />
                নতুন public ID-তে ফাইল থাকলে বদলে দিন
              </label>
            </div>
            {protectedAsset || isProtectedPath(toPublicId) ? <ProtectedWarning /> : null}
            <div className="flex justify-end">
              <Button
                onClick={requestRename}
                loading={busy === "rename"}
                disabled={!renameChanged || !toPublicId.trim() || busy !== null}
                icon={<PenIcon className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                পরিবর্তন সংরক্ষণ
              </Button>
            </div>
          </Section>

          <Section title="ফাইল মুছুন">
            <p className="text-sm text-(--text-3)">
              মুছে ফেলা ফাইল ফেরত আনা যায় না, এবং CDN থেকেও সরিয়ে দেওয়া হবে।
            </p>
            <div className="flex justify-end">
              <Button
                tone="danger"
                onClick={() => setPending({ kind: "delete" })}
                disabled={busy !== null}
                icon={<TrashIcon className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                ফাইল মুছুন
              </Button>
            </div>
          </Section>
        </div>
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        onClose={closeConfirm}
        busy={busy === "rename" || busy === "delete"}
        title={pending?.kind === "delete" ? "ফাইলটি মুছে ফেলবেন?" : "উৎস ফাইলের নাম বদলাবেন?"}
        confirmLabel={pending?.kind === "delete" ? "মুছে ফেলুন" : "নাম বদলান"}
        onConfirm={() => {
          if (pending?.kind === "delete") void remove();
          else if (pending?.kind === "rename") void rename(pending);
        }}
        message={
          <div className="flex flex-col gap-3">
            {pending?.kind === "rename" ? (
              <p className="break-all">
                {current.publicId} ({deliveryLabel(current.type)}) থেকে {pending.toPublicId} (
                {deliveryLabel(pending.toType)})
              </p>
            ) : (
              <p className="break-all">
                {current.publicId} স্থায়ীভাবে মুছে যাবে। এই কাজ ফেরানো যায় না।
              </p>
            )}
            {protectedAsset ||
            (pending?.kind === "rename" && isProtectedPath(pending.toPublicId)) ? (
              <ProtectedWarning />
            ) : null}
          </div>
        }
      />
    </>
  );
}
