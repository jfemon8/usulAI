"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, Dialog, useToast } from "@/components/admin/Dialog";
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  LoadError,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { CharCount, SaveBar, Toggle, useUnsavedWarning } from "@/components/admin/site/FormBits";
import { HomePreview } from "@/components/admin/site/HomePreview";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import {
  DEFAULT_HOME_CONTENT,
  SITE_CONTENT_LIMITS,
  safeLinkUrl,
  splitBulkQuestions,
  type AnnouncementTone,
  type HomeContent,
} from "@/lib/site/contentShape";

interface SiteResponse {
  content: HomeContent;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface SuggestionRow {
  id: number;
  text: string;
}

interface FormState {
  bismillah: string;
  greeting: string;
  subtitle: string;
  suggestions: SuggestionRow[];
  announcement: {
    enabled: boolean;
    text: string;
    tone: AnnouncementTone;
    linkLabel: string;
    linkUrl: string;
  };
}

const LONG_DASH = String.fromCharCode(0x2014);
let rowCounter = 0;

function row(text: string): SuggestionRow {
  rowCounter += 1;
  return { id: rowCounter, text };
}

function toForm(content: HomeContent): FormState {
  return {
    bismillah: content.bismillah,
    greeting: content.greeting,
    subtitle: content.subtitle,
    suggestions: content.suggestions.map(row),
    announcement: {
      enabled: content.announcement.enabled,
      text: content.announcement.text,
      tone: content.announcement.tone,
      linkLabel: content.announcement.link?.label ?? "",
      linkUrl: content.announcement.link?.url ?? "",
    },
  };
}

function toContent(form: FormState): HomeContent {
  const label = form.announcement.linkLabel.trim();
  const url = form.announcement.linkUrl.trim();
  return {
    bismillah: form.bismillah.trim(),
    greeting: form.greeting.trim(),
    subtitle: form.subtitle.trim(),
    suggestions: form.suggestions.map((suggestion) => suggestion.text.replace(/\s+/g, " ").trim()),
    announcement: {
      enabled: form.announcement.enabled,
      text: form.announcement.text.trim(),
      tone: form.announcement.tone,
      ...(label || url ? { link: { label, url } } : {}),
    },
  };
}

function textError(value: string, max: number, required = false): string | null {
  if (required && value.trim().length === 0) return "খালি রাখা যাবে না।";
  if (value.length > max) return `সর্বোচ্চ ${formatCount(max)} অক্ষর।`;
  if (value.includes(LONG_DASH)) return "লম্বা ড্যাশ ব্যবহার করবেন না, কমা বা হাইফেন দিন।";
  return null;
}

function validate(form: FormState) {
  const seen = new Map<string, number>();
  const suggestionErrors = new Map<number, string>();

  for (const suggestion of form.suggestions) {
    const text = suggestion.text.replace(/\s+/g, " ").trim();
    const error = textError(text, SITE_CONTENT_LIMITS.suggestionChars, true);
    if (error) {
      suggestionErrors.set(suggestion.id, error);
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) suggestionErrors.set(suggestion.id, "এই প্রশ্নটি তালিকায় আগেই আছে।");
    else seen.set(key, suggestion.id);
  }

  const { announcement } = form;
  const hasLink = announcement.linkLabel.trim() || announcement.linkUrl.trim();

  const errors = {
    bismillah: textError(form.bismillah, SITE_CONTENT_LIMITS.bismillahChars),
    greeting: textError(form.greeting, SITE_CONTENT_LIMITS.greetingChars, true),
    subtitle: textError(form.subtitle, SITE_CONTENT_LIMITS.subtitleChars),
    list:
      form.suggestions.length > SITE_CONTENT_LIMITS.maxSuggestions
        ? `সর্বোচ্চ ${formatCount(SITE_CONTENT_LIMITS.maxSuggestions)}টি প্রশ্ন রাখা যাবে।`
        : null,
    announcementText:
      announcement.enabled && announcement.text.trim().length === 0
        ? "ঘোষণা চালু থাকলে লেখা দিতে হবে।"
        : textError(announcement.text, SITE_CONTENT_LIMITS.announcementChars),
    linkLabel: hasLink
      ? textError(announcement.linkLabel, SITE_CONTENT_LIMITS.linkLabelChars, true)
      : null,
    linkUrl:
      hasLink && !safeLinkUrl(announcement.linkUrl)
        ? "ঠিকানা http:// বা https:// দিয়ে, অথবা সাইটের ভেতরের পথ / দিয়ে শুরু করুন।"
        : null,
  };

  const count =
    suggestionErrors.size + Object.values(errors).filter((value) => value !== null).length;
  return { errors, suggestionErrors, count };
}

export function SiteContentEditor() {
  const toast = useToast();
  const { data, error, loading, reload, replace } = useAdminData<SiteResponse>("/api/admin/site");
  const [source, setSource] = useState<SiteResponse | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const closeBulk = useCallback(() => setBulkOpen(false), []);
  const closeReset = useCallback(() => setResetOpen(false), []);

  if (data && data !== source) {
    setSource(data);
    setForm(toForm(data.content));
  }

  const current = form ? toContent(form) : null;
  const dirty =
    current !== null && data !== null && JSON.stringify(current) !== JSON.stringify(data.content);
  useUnsavedWarning(dirty);

  if (error && !data) {
    return (
      <>
        <PageHeader title="সাইট কনটেন্ট" />
        <LoadError message={error} onRetry={reload} />
      </>
    );
  }

  if (loading || !form || !current || !data) {
    return (
      <>
        <PageHeader title="সাইট কনটেন্ট" description="হোম পেজের লেখা ও ঘোষণা" />
        <Skeleton rows={6} />
      </>
    );
  }

  const { errors, suggestionErrors, count: errorCount } = validate(form);
  const visibleError = (message: string | null) => (showErrors ? message : null);

  function update(patch: Partial<FormState>) {
    setForm((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  function updateAnnouncement(patch: Partial<FormState["announcement"]>) {
    setForm((previous) =>
      previous ? { ...previous, announcement: { ...previous.announcement, ...patch } } : previous,
    );
  }

  function setSuggestions(next: (rows: SuggestionRow[]) => SuggestionRow[]) {
    setForm((previous) =>
      previous ? { ...previous, suggestions: next(previous.suggestions) } : previous,
    );
  }

  function move(index: number, offset: number) {
    setSuggestions((rows) => {
      const target = index + offset;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });
  }

  function addQuestion() {
    const text = newQuestion.replace(/\s+/g, " ").trim();
    if (!text) return;
    setSuggestions((rows) => [...rows, row(text)]);
    setNewQuestion("");
  }

  function applyBulk(mode: "append" | "replace") {
    const lines = splitBulkQuestions(bulkText);
    if (lines.length === 0) {
      toast.error("কোনো প্রশ্ন পাওয়া যায়নি। প্রতি লাইনে একটি করে প্রশ্ন দিন।");
      return;
    }
    setSuggestions((rows) => {
      const existing =
        mode === "append" ? new Set(rows.map((item) => item.text.trim().toLowerCase())) : new Set();
      const added = lines.filter((line) => {
        const key = line.toLowerCase();
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      return mode === "append" ? [...rows, ...added.map(row)] : added.map(row);
    });
    setBulkOpen(false);
    setBulkText("");
    toast.success(`${formatCount(lines.length)}টি লাইন থেকে প্রশ্ন নেওয়া হয়েছে।`);
  }

  async function save() {
    if (!current) return;
    if (errorCount > 0) {
      setShowErrors(true);
      toast.error("কিছু ঘরে ভুল আছে। লাল লেখা দেখে ঠিক করুন।");
      return;
    }
    setSaving(true);
    try {
      const saved = await adminApi<SiteResponse>("/api/admin/site", {
        method: "PUT",
        body: current,
      });
      replace(saved);
      setShowErrors(false);
      toast.success("সাইট কনটেন্ট সংরক্ষিত হয়েছে। হোম পেজে কয়েক মুহূর্তের মধ্যে দেখা যাবে।");
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="সাইট কনটেন্ট"
        description="হোম পেজ ও এম্বেড উইজেটের শুরুর লেখা, প্রস্তাবিত প্রশ্ন আর ঘোষণা এখান থেকে বদলান।"
        actions={
          <Button tone="ghost" onClick={() => setResetOpen(true)}>
            ডিফল্টে ফেরত নিন
          </Button>
        }
      />

      {data.updatedAt ? (
        <p className="-mt-3 mb-5 text-xs text-(--text-3)">
          সর্বশেষ হালনাগাদ: {formatWhen(data.updatedAt)}
          {data.updatedBy ? `, ${data.updatedBy}` : ""}
        </p>
      ) : (
        <p className="-mt-3 mb-5 text-xs text-(--text-3)">
          এখনো কিছু সংরক্ষণ করা হয়নি, সাইটে ডিফল্ট লেখা দেখানো হচ্ছে।
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="শুভেচ্ছা" description="খালি চ্যাটের মাঝখানে যা দেখা যায়">
            <div className="flex flex-col gap-4">
              <Field
                label="বিসমিল্লাহ লাইন"
                hint="আরবি লাইনটি খালি রাখলে দেখানো হবে না।"
                error={visibleError(errors.bismillah)}
              >
                {(id) => (
                  <Input
                    id={id}
                    dir="rtl"
                    className="arabic"
                    value={form.bismillah}
                    onChange={(event) => update({ bismillah: event.target.value })}
                  />
                )}
              </Field>
              <Field
                label="শুভেচ্ছা বাক্য"
                error={
                  errors.greeting && (showErrors || !form.greeting.trim()) ? errors.greeting : null
                }
              >
                {(id) => (
                  <Input
                    id={id}
                    value={form.greeting}
                    onChange={(event) => update({ greeting: event.target.value })}
                  />
                )}
              </Field>
              <Field
                label="উপশিরোনাম"
                hint={<CharCount value={form.subtitle} max={SITE_CONTENT_LIMITS.subtitleChars} />}
                error={visibleError(errors.subtitle)}
              >
                {(id) => (
                  <Textarea
                    id={id}
                    rows={3}
                    value={form.subtitle}
                    onChange={(event) => update({ subtitle: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card
            title="প্রস্তাবিত প্রশ্ন"
            description={`হোম পেজে প্রতিবার এলোমেলোভাবে ৪টি দেখানো হয়। মোট ${formatCount(
              form.suggestions.length,
            )}টি, সর্বোচ্চ ${formatCount(SITE_CONTENT_LIMITS.maxSuggestions)}টি।`}
            actions={
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                একসাথে পেস্ট করুন
              </Button>
            }
          >
            {errors.list ? <p className="mb-3 text-sm text-(--danger)">{errors.list}</p> : null}
            {form.suggestions.length === 0 ? (
              <p className="mb-3 rounded-xl bg-(--surface-2) px-4 py-3 text-sm text-(--text-2)">
                কোনো প্রশ্ন নেই। তালিকা খালি থাকলে হোম পেজে প্রস্তাবিত প্রশ্ন দেখানো হবে না।
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {form.suggestions.map((suggestion, index) => {
                  const rowError = suggestionErrors.get(suggestion.id);
                  const shownError =
                    rowError && (showErrors || rowError === "এই প্রশ্নটি তালিকায় আগেই আছে।")
                      ? rowError
                      : null;
                  return (
                    <li key={suggestion.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-7 shrink-0 text-end text-xs text-(--text-3) tabular-nums">
                          {formatCount(index + 1)}
                        </span>
                        <Input
                          aria-label={`প্রশ্ন ${index + 1}`}
                          aria-invalid={shownError ? true : undefined}
                          value={suggestion.text}
                          className={clsx("min-w-0 flex-1", shownError && "border-(--danger)")}
                          onChange={(event) => {
                            const text = event.target.value;
                            setSuggestions((rows) =>
                              rows.map((item) =>
                                item.id === suggestion.id ? { ...item, text } : item,
                              ),
                            );
                          }}
                        />
                        <div className="flex shrink-0">
                          <IconButton
                            label="উপরে নিন"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                            className="h-9 w-8 sm:w-9"
                          >
                            <ChevronLeftIcon className="h-4 w-4 rotate-90" />
                          </IconButton>
                          <IconButton
                            label="নিচে নিন"
                            disabled={index === form.suggestions.length - 1}
                            onClick={() => move(index, 1)}
                            className="h-9 w-8 sm:w-9"
                          >
                            <ChevronRightIcon className="h-4 w-4 rotate-90" />
                          </IconButton>
                          <IconButton
                            label="মুছুন"
                            onClick={() =>
                              setSuggestions((rows) =>
                                rows.filter((item) => item.id !== suggestion.id),
                              )
                            }
                            className="h-9 w-8 hover:text-(--danger) sm:w-9"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </div>
                      {shownError ? (
                        <p className="ps-9 text-xs text-(--danger)">{shownError}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}

            <form
              className="mt-4 flex flex-col gap-2 border-t border-(--border) pt-4 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                addQuestion();
              }}
            >
              <Input
                aria-label="নতুন প্রশ্ন"
                placeholder="নতুন প্রশ্ন লিখুন"
                value={newQuestion}
                maxLength={SITE_CONTENT_LIMITS.suggestionChars}
                onChange={(event) => setNewQuestion(event.target.value)}
              />
              <Button
                type="submit"
                icon={<PlusIcon className="h-4 w-4" />}
                disabled={
                  newQuestion.trim().length === 0 ||
                  form.suggestions.length >= SITE_CONTENT_LIMITS.maxSuggestions
                }
              >
                যোগ করুন
              </Button>
            </form>
          </Card>

          <Card title="ঘোষণা" description="চ্যাটের উপরে একটি সরু ব্যানার, পাঠক বন্ধ করে দিতে পারেন">
            <div className="flex flex-col gap-4">
              <Toggle
                label="ঘোষণা দেখান"
                description="লেখা বদলালে যারা আগে বন্ধ করেছিলেন তারাও নতুন ঘোষণা দেখবেন।"
                checked={form.announcement.enabled}
                onChange={(enabled) => updateAnnouncement({ enabled })}
              />
              <Field
                label="ঘোষণার লেখা"
                hint={
                  <CharCount
                    value={form.announcement.text}
                    max={SITE_CONTENT_LIMITS.announcementChars}
                  />
                }
                error={
                  errors.announcementText && (showErrors || form.announcement.enabled)
                    ? errors.announcementText
                    : null
                }
              >
                {(id) => (
                  <Textarea
                    id={id}
                    rows={2}
                    className="min-h-16"
                    value={form.announcement.text}
                    onChange={(event) => updateAnnouncement({ text: event.target.value })}
                  />
                )}
              </Field>
              <Field label="ধরন">
                {(id) => (
                  <Select
                    id={id}
                    value={form.announcement.tone}
                    onChange={(event) =>
                      updateAnnouncement({
                        tone: event.target.value === "warning" ? "warning" : "info",
                      })
                    }
                  >
                    <option value="info">তথ্য</option>
                    <option value="warning">সতর্কতা</option>
                  </Select>
                )}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="লিংকের লেখা (ঐচ্ছিক)" error={visibleError(errors.linkLabel)}>
                  {(id) => (
                    <Input
                      id={id}
                      value={form.announcement.linkLabel}
                      onChange={(event) => updateAnnouncement({ linkLabel: event.target.value })}
                    />
                  )}
                </Field>
                <Field
                  label="লিংকের ঠিকানা (ঐচ্ছিক)"
                  hint="https:// দিয়ে বাইরের সাইট নতুন ট্যাবে খুলবে, / দিয়ে সাইটের ভেতরের পাতা।"
                  error={visibleError(errors.linkUrl)}
                >
                  {(id) => (
                    <Input
                      id={id}
                      type="url"
                      inputMode="url"
                      dir="ltr"
                      placeholder="https://"
                      value={form.announcement.linkUrl}
                      onChange={(event) => updateAnnouncement({ linkUrl: event.target.value })}
                    />
                  )}
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="min-w-0 lg:sticky lg:top-6">
          <Card
            title="প্রিভিউ"
            description="সংরক্ষণের আগে কেমন দেখাবে"
            actions={dirty ? <Badge tone="warn">অসংরক্ষিত</Badge> : <Badge>সংরক্ষিত</Badge>}
            padded={false}
          >
            <HomePreview content={current} />
          </Card>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        message={
          showErrors && errorCount > 0 ? `${formatCount(errorCount)}টি ঘরে ভুল আছে।` : undefined
        }
      >
        <Button
          onClick={() => {
            setForm(toForm(data.content));
            setShowErrors(false);
          }}
          disabled={!dirty || saving}
          className="w-full sm:w-auto"
        >
          বাতিল
        </Button>
        <Button
          tone="primary"
          onClick={() => void save()}
          loading={saving}
          disabled={!dirty}
          className="w-full sm:w-auto"
        >
          সংরক্ষণ করুন
        </Button>
      </SaveBar>

      <Dialog
        open={bulkOpen}
        onClose={closeBulk}
        title="একসাথে প্রশ্ন পেস্ট করুন"
        description="প্রতি লাইনে একটি প্রশ্ন। শুরুর ক্রমিক নম্বর বা বুলেট নিজে থেকে বাদ যাবে, একই প্রশ্ন দুইবার নেওয়া হবে না।"
        size="lg"
        footer={
          <>
            <Button onClick={() => applyBulk("replace")} className="w-full sm:w-auto">
              পুরো তালিকা বদলে দিন
            </Button>
            <Button tone="primary" onClick={() => applyBulk("append")} className="w-full sm:w-auto">
              শেষে যোগ করুন
            </Button>
          </>
        }
      >
        <Textarea
          aria-label="প্রশ্নের তালিকা"
          rows={10}
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={"নামাজের শর্ত কী কী?\nযাকাত কাদের উপর ফরজ?"}
        />
        <p className="mt-2 text-xs text-(--text-3)">
          {formatCount(splitBulkQuestions(bulkText).length)}টি লাইন পাওয়া গেছে।
        </p>
      </Dialog>

      <ConfirmDialog
        open={resetOpen}
        title="ডিফল্টে ফেরত নেবেন?"
        message="শুভেচ্ছা, উপশিরোনাম, প্রস্তাবিত প্রশ্নের তালিকা আর ঘোষণা ডিফল্ট অবস্থায় ফিরবে। সংরক্ষণ না করা পর্যন্ত সাইটে কিছু বদলাবে না।"
        confirmLabel="ডিফল্ট বসান"
        tone="primary"
        onClose={closeReset}
        onConfirm={() => {
          setForm(toForm(DEFAULT_HOME_CONTENT));
          setResetOpen(false);
          setShowErrors(false);
          toast.success("ডিফল্ট লেখা বসানো হয়েছে। রাখতে চাইলে সংরক্ষণ করুন।");
        }}
      />
    </>
  );
}
