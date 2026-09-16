"use client";

import { useState } from "react";
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
  PageHeader,
  Skeleton,
  Textarea,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { PenIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import { MASAIL_CONFIG } from "@/config/site";

interface Topic {
  slug: string;
  name: string;
  description: string;
  order: number;
  path: string;
  count: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface TopicsResponse {
  items: Topic[];
  limits: { nameChars: number; descriptionChars: number; maxCategories: number };
}

interface FormState {
  slug: string | null;
  name: string;
  description: string;
  order: string;
}

const EMPTY: FormState = { slug: null, name: "", description: "", order: "0" };

export function TopicManager() {
  const toast = useToast();
  const { data, error, loading, reload, replace } = useAdminData<TopicsResponse>("/api/admin/topics");
  const [form, setForm] = useState<FormState | null>(null);
  const [removing, setRemoving] = useState<Topic | null>(null);
  const [saving, setSaving] = useState(false);

  if (error && !data) {
    return (
      <>
        <PageHeader title="মাসআলার বিষয়" />
        <LoadError message={error} onRetry={reload} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <PageHeader title="মাসআলার বিষয়" description="পাঠকের জন্য বিষয়ভিত্তিক পাতা" />
        <Skeleton rows={4} />
      </>
    );
  }

  const nameError =
    form && form.name.trim().length > data.limits.nameChars
      ? `সর্বোচ্চ ${formatCount(data.limits.nameChars)} অক্ষর।`
      : null;

  async function submit() {
    if (!form || !form.name.trim() || nameError) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        order: Number(form.order) || 0,
        ...(form.slug ? { slug: form.slug } : {}),
      };
      const saved = await adminApi<TopicsResponse>("/api/admin/topics", {
        method: form.slug ? "PATCH" : "POST",
        body,
      });
      replace(saved);
      setForm(null);
      toast.success(form.slug ? "বিষয় হালনাগাদ হয়েছে।" : "নতুন বিষয় যোগ হয়েছে।");
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  async function remove(topic: Topic) {
    setSaving(true);
    try {
      const saved = await adminApi<TopicsResponse>("/api/admin/topics", {
        method: "DELETE",
        body: { slug: topic.slug },
      });
      replace(saved);
      setRemoving(null);
      toast.success("বিষয়টি মুছে ফেলা হয়েছে।");
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="মাসআলার বিষয়"
        description="নামাজ, রোজা, যাকাতের মতো বিষয় তৈরি করুন। প্রতিটি বিষয়ের আলাদা পাবলিক পাতা তৈরি হয়, যা সার্চ ইঞ্জিনে আসে।"
        actions={
          <Button
            tone="primary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => setForm({ ...EMPTY, order: String(data.items.length) })}
          >
            নতুন বিষয়
          </Button>
        }
      />

      {data.items.length === 0 ? (
        <EmptyState title="এখনো কোনো বিষয় নেই">
          বিষয় যোগ করলে পাঠক {MASAIL_CONFIG.topicPath} পাতায় বিষয় ধরে মাসআলা খুঁজে পাবেন।
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((topic) => (
            <li key={topic.slug}>
              <Card padded={false}>
                <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-(--text-1)">{topic.name}</span>
                      <Badge>{formatCount(topic.count)} মাসআলা</Badge>
                      <Badge>ক্রম {formatCount(topic.order)}</Badge>
                    </div>
                    {topic.description ? (
                      <p className="mt-1 text-sm text-(--text-2)">{topic.description}</p>
                    ) : null}
                    <p className="mt-1.5 font-mono text-xs break-all text-(--text-3)">
                      {topic.path}
                    </p>
                    {topic.updatedAt ? (
                      <p className="mt-1 text-xs text-(--text-3)">
                        {formatWhen(topic.updatedAt)}
                        {topic.updatedBy ? `, ${topic.updatedBy}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-1.5">
                    <IconButton
                      label="সম্পাদনা"
                      onClick={() =>
                        setForm({
                          slug: topic.slug,
                          name: topic.name,
                          description: topic.description,
                          order: String(topic.order),
                        })
                      }
                    >
                      <PenIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="মুছুন"
                      className="hover:text-(--danger)"
                      onClick={() => setRemoving(topic)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.slug ? "বিষয় সম্পাদনা" : "নতুন বিষয়"}
        footer={
          <>
            <Button onClick={() => setForm(null)} disabled={saving}>
              বাতিল
            </Button>
            <Button
              tone="primary"
              onClick={() => void submit()}
              loading={saving}
              disabled={!form?.name.trim() || Boolean(nameError)}
            >
              সংরক্ষণ করুন
            </Button>
          </>
        }
      >
        {form ? (
          <div className="flex flex-col gap-4">
            {form.slug ? (
              <Notice tone="neutral">
                ঠিকানা বদলায় না, তাই নাম বদলালেও পুরোনো লিংক কাজ করতে থাকবে: {form.slug}
              </Notice>
            ) : null}
            <Field label="নাম" error={nameError}>
              {(id) => (
                <Input
                  id={id}
                  value={form.name}
                  maxLength={data.limits.nameChars}
                  placeholder="যেমন নামাজ"
                  onChange={(event) =>
                    setForm((previous) =>
                      previous ? { ...previous, name: event.target.value } : previous,
                    )
                  }
                />
              )}
            </Field>
            <Field label="সংক্ষিপ্ত বর্ণনা" hint="বিষয়ের পাতায় ও সার্চ ফলাফলে দেখানো হয়">
              {(id) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={form.description}
                  maxLength={data.limits.descriptionChars}
                  placeholder="নামাজের সময়, শর্ত, ভঙ্গের কারণ ও সংশোধন নিয়ে মাসআলা।"
                  onChange={(event) =>
                    setForm((previous) =>
                      previous ? { ...previous, description: event.target.value } : previous,
                    )
                  }
                />
              )}
            </Field>
            <Field label="ক্রম" hint="ছোট সংখ্যা আগে দেখাবে">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={9999}
                  value={form.order}
                  onChange={(event) =>
                    setForm((previous) =>
                      previous ? { ...previous, order: event.target.value } : previous,
                    )
                  }
                />
              )}
            </Field>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => void (removing && remove(removing))}
        title="বিষয় মুছে ফেলবেন?"
        confirmLabel="মুছে ফেলুন"
        tone="danger"
        busy={saving}
        message={
          removing ? `${removing.name} বিষয়টি মুছে ফেলা হবে। এটি ফিরিয়ে আনা যাবে না।` : ""
        }
      />
    </>
  );
}
