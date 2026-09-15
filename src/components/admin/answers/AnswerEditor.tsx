"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { AdminApiError, adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import { SOURCE_NAMES } from "@/components/admin/labels";
import {
  Button,
  Card,
  Field,
  IconButton,
  Input,
  LoadError,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { OriginBadge } from "@/components/admin/answers/AnswerList";
import { CharCount, SaveBar, useUnsavedWarning } from "@/components/admin/site/FormBits";
import { RichTextField } from "@/components/editor/RichTextField";
import { AlertIcon, CheckIcon, ChevronLeftIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import { RATE_LIMIT_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import type { AnswerSource, SourceType } from "@/types";

const ANSWER_CHARS = 20_000;
const NOTE_CHARS = 1_000;
const MAX_SOURCES = 20;

interface AnswerDetail {
  id: string;
  question: string;
  origin: "scholar" | "auto";
  servedCount: number;
  sourceCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  author: { name: string; category: string } | null;
  published: boolean;
  publishedAt: string | null;
  answer: string;
  reviewerNote: string;
  topic: string;
  sources: AnswerSource[];
  updatedBy: string | null;
}

interface SourceRow {
  id: number;
  sourceType: SourceType;
  reference: string;
}

interface ReferenceCheck {
  sourceType: SourceType;
  reference: string;
  found: boolean;
  foundSourceType?: SourceType;
}

interface FormState {
  question: string;
  answer: string;
  origin: "scholar" | "auto";
  reviewerNote: string;
  sources: SourceRow[];
}

let sourceCounter = 0;

function sourceRow(sourceType: SourceType, reference: string): SourceRow {
  sourceCounter += 1;
  return { id: sourceCounter, sourceType, reference };
}

function toForm(detail: AnswerDetail | null): FormState {
  return {
    question: detail?.question ?? "",
    answer: detail?.answer ?? "",
    origin: detail?.origin ?? "scholar",
    reviewerNote: detail?.reviewerNote ?? "",
    sources: (detail?.sources ?? []).map((source) =>
      sourceRow(source.sourceType, source.reference),
    ),
  };
}

function payload(form: FormState) {
  return {
    question: form.question.trim(),
    answer: form.answer.trim(),
    origin: form.origin,
    reviewerNote: form.reviewerNote.trim(),
    sources: form.sources
      .filter((source) => source.reference.trim())
      .map((source) => ({ sourceType: source.sourceType, reference: source.reference.trim() })),
  };
}

function checkKey(sourceType: SourceType, reference: string): string {
  return `${sourceType}|${reference.trim()}`;
}

export function AnswerEditor({ id }: { id?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload, replace } = useAdminData<AnswerDetail>(
    id ? `/api/admin/answers/${id}` : null,
  );
  const [source, setSource] = useState<AnswerDetail | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(null));
  const [baseline, setBaseline] = useState(() => JSON.stringify(payload(toForm(null))));
  const [checks, setChecks] = useState<Map<string, ReferenceCheck>>(new Map());
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const closeDelete = useCallback(() => setDeleteOpen(false), []);

  if (data && data !== source) {
    const next = toForm(data);
    setSource(data);
    setForm(next);
    setBaseline(JSON.stringify(payload(next)));
    setChecks(
      new Map(
        data.sources.map((item) => [
          checkKey(item.sourceType, item.reference),
          { sourceType: item.sourceType, reference: item.reference, found: true },
        ]),
      ),
    );
  }

  const body = payload(form);
  const dirty = JSON.stringify(body) !== baseline;
  useUnsavedWarning(dirty && !saving);

  if (id && error && !data) {
    return (
      <>
        <BackLink />
        <PageHeader title="উত্তর সম্পাদনা" />
        <LoadError message={error} onRetry={reload} />
      </>
    );
  }

  if (id && (loading || !data)) {
    return (
      <>
        <BackLink />
        <PageHeader title="উত্তর সম্পাদনা" />
        <Skeleton rows={6} />
      </>
    );
  }

  const questionError =
    body.question.length > RATE_LIMIT_CONFIG.maxQuestionChars
      ? `সর্বোচ্চ ${formatCount(RATE_LIMIT_CONFIG.maxQuestionChars)} অক্ষর।`
      : null;
  const answerError =
    body.answer.length > ANSWER_CHARS ? `সর্বোচ্চ ${formatCount(ANSWER_CHARS)} অক্ষর।` : null;
  const noteError =
    body.reviewerNote.length > NOTE_CHARS ? `সর্বোচ্চ ${formatCount(NOTE_CHARS)} অক্ষর।` : null;
  const duplicateKeys = new Set<string>();
  const seenKeys = new Set<string>();
  for (const row of form.sources) {
    if (!row.reference.trim()) continue;
    const key = checkKey(row.sourceType, row.reference);
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
  }
  const missing = body.sources.filter(
    (item) => checks.get(checkKey(item.sourceType, item.reference))?.found === false,
  );
  const canSave =
    dirty &&
    body.question.length > 0 &&
    body.answer.length > 0 &&
    !questionError &&
    !answerError &&
    !noteError &&
    duplicateKeys.size === 0 &&
    missing.length === 0;

  function patch(update: Partial<FormState>) {
    setForm((previous) => ({ ...previous, ...update }));
  }

  function updateSource(rowId: number, update: Partial<SourceRow>) {
    setForm((previous) => ({
      ...previous,
      sources: previous.sources.map((row) => (row.id === rowId ? { ...row, ...update } : row)),
    }));
  }

  async function checkReferences(): Promise<boolean> {
    if (body.sources.length === 0) return true;
    setChecking(true);
    try {
      const result = await adminApi<{ checks: ReferenceCheck[] }>("/api/admin/answers/references", {
        method: "POST",
        body: { sources: body.sources },
      });
      setChecks((previous) => {
        const next = new Map(previous);
        for (const check of result.checks) {
          next.set(checkKey(check.sourceType, check.reference), check);
        }
        return next;
      });
      const notFound = result.checks.filter((check) => !check.found).length;
      if (notFound > 0) toast.error(`${formatCount(notFound)}টি রেফারেন্স পাওয়া যায়নি।`);
      else toast.success("সব রেফারেন্স দলিল ভান্ডারে পাওয়া গেছে।");
      return notFound === 0;
    } catch (failure) {
      toast.error(errorMessage(failure));
      return false;
    } finally {
      setChecking(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await adminApi<AnswerDetail>(
        id ? `/api/admin/answers/${id}` : "/api/admin/answers",
        { method: id ? "PUT" : "POST", body },
      );
      if (id) {
        replace(saved);
        toast.success("উত্তরটি হালনাগাদ হয়েছে।");
      } else {
        setBaseline(JSON.stringify(body));
        toast.success("নতুন যাচাইকৃত উত্তর যোগ হয়েছে।");
        router.replace(`/admin/answers/${saved.id}`);
      }
    } catch (failure) {
      toast.error(errorMessage(failure));
      if (failure instanceof AdminApiError && failure.status === 422) void checkReferences();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id) return;
    setDeleting(true);
    try {
      await adminApi(`/api/admin/answers/${id}`, { method: "DELETE" });
      setBaseline(JSON.stringify(body));
      toast.success("উত্তরটি মুছে ফেলা হয়েছে।");
      router.push("/admin/answers");
    } catch (failure) {
      toast.error(errorMessage(failure));
      setDeleting(false);
    }
  }

  const editorSources = form.sources
    .filter((row) => row.reference.trim())
    .map((row, index) => ({
      index: index + 1,
      reference: `${SOURCE_NAMES[row.sourceType]}: ${row.reference.trim()}`,
    }));

  return (
    <>
      <BackLink />
      <PageHeader
        title={id ? "উত্তর সম্পাদনা" : "নতুন যাচাইকৃত উত্তর"}
        description="প্রশ্নটি হুবহু বা একই বিষয়ে এলে এই উত্তর ও সূত্র মডেল ছাড়াই দেখানো হবে। প্রতিটি সূত্র দলিল ভান্ডারে থাকতে হবে।"
        actions={
          id ? (
            <Button
              tone="ghost"
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={() => setDeleteOpen(true)}
              className="hover:text-(--danger)"
            >
              মুছুন
            </Button>
          ) : undefined
        }
      />

      {data ? (
        <div className="-mt-2 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-(--text-3)">
          <OriginBadge origin={data.origin} />
          {data.author ? (
            <span>
              লেখক: {data.author.category} {data.author.name}
            </span>
          ) : null}
          {data.published ? (
            <span>প্রকাশিত {formatWhen(data.publishedAt)}</span>
          ) : data.author ? (
            <span>অপ্রকাশিত</span>
          ) : null}
          <span>দেখানো হয়েছে {formatCount(data.servedCount)} বার</span>
          <span>তৈরি {formatWhen(data.createdAt)}</span>
          {data.updatedAt ? (
            <span>
              হালনাগাদ {formatWhen(data.updatedAt)}
              {data.updatedBy ? `, ${data.updatedBy}` : ""}
            </span>
          ) : null}
          {data.topic ? <span className="break-all">বিষয়-চাবি: {data.topic}</span> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        <Card>
          <div className="flex flex-col gap-4">
            <Field
              label="প্রশ্ন"
              hint={<CharCount value={form.question} max={RATE_LIMIT_CONFIG.maxQuestionChars} />}
              error={questionError}
            >
              {(fieldId) => (
                <Input
                  id={fieldId}
                  value={form.question}
                  onChange={(event) => patch({ question: event.target.value })}
                  placeholder="যেমন: যাকাত কাদের উপর ফরজ?"
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="ধরন"
                hint="আলেমের অনুমোদিত উত্তর নেতিবাচক মতামতে সরে যায় না; স্বয়ংক্রিয় উত্তর সরে যায়।"
              >
                {(fieldId) => (
                  <Select
                    id={fieldId}
                    value={form.origin}
                    onChange={(event) =>
                      patch({ origin: event.target.value === "auto" ? "auto" : "scholar" })
                    }
                  >
                    <option value="scholar">আলেমের অনুমোদিত</option>
                    <option value="auto">স্বয়ংক্রিয়</option>
                  </Select>
                )}
              </Field>
              <Field
                label="পর্যালোচকের নোট (ঐচ্ছিক)"
                hint={<CharCount value={form.reviewerNote} max={NOTE_CHARS} />}
                error={noteError}
              >
                {(fieldId) => (
                  <Input
                    id={fieldId}
                    value={form.reviewerNote}
                    onChange={(event) => patch({ reviewerNote: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </div>
        </Card>

        <Card
          title="উত্তর"
          description="টুলবার দিয়ে বিন্যাস করুন। সূত্রের নম্বর [1], [2] নিচের তালিকার ক্রম অনুযায়ী, টুলবারের সূত্র বোতাম থেকেও বসানো যায়।"
        >
          <RichTextField
            value={form.answer}
            onChange={(answer) => patch({ answer })}
            label="উত্তরের লেখা"
            placeholder="উত্তর লিখুন…"
            minHeight={384}
            maxLength={ANSWER_CHARS}
            invalid={Boolean(answerError)}
            sources={editorSources}
          />
          {answerError ? (
            <p className="mt-2 text-xs leading-5 text-(--danger)">{answerError}</p>
          ) : null}
        </Card>

        <Card
          title="সূত্র"
          description={`দলিল ভান্ডারের রেফারেন্স হুবহু লিখুন, যেমন "Al-Baqara 2:255" বা "সহীহ বুখারী 1"। সর্বোচ্চ ${formatCount(MAX_SOURCES)}টি।`}
          actions={
            <Button
              size="sm"
              onClick={() => void checkReferences()}
              loading={checking}
              disabled={body.sources.length === 0}
            >
              যাচাই করুন
            </Button>
          }
        >
          {form.sources.length === 0 ? (
            <p className="mb-3 rounded-xl bg-(--surface-2) px-4 py-3 text-sm text-(--text-2)">
              কোনো সূত্র নেই। সূত্র ছাড়া উত্তর পাঠকের কাছে দলিলহীন দেখাবে, তাই অন্তত একটি সূত্র
              দিন।
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {form.sources.map((row, index) => {
                const key = checkKey(row.sourceType, row.reference);
                const check = row.reference.trim() ? checks.get(key) : undefined;
                const duplicate = duplicateKeys.has(key);
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-(--border) p-3 sm:border-0 sm:p-0"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <div className="flex items-center gap-2 sm:w-52 sm:shrink-0">
                        <span className="w-6 shrink-0 text-xs text-(--text-3) tabular-nums">
                          [{index + 1}]
                        </span>
                        <Select
                          aria-label={`সূত্র ${index + 1} এর উৎস`}
                          value={row.sourceType}
                          onChange={(event) =>
                            updateSource(row.id, { sourceType: event.target.value as SourceType })
                          }
                        >
                          {SOURCE_PRIORITY.map((type) => (
                            <option key={type} value={type}>
                              {SOURCE_NAMES[type]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <Input
                          aria-label={`সূত্র ${index + 1} এর রেফারেন্স`}
                          value={row.reference}
                          onChange={(event) =>
                            updateSource(row.id, { reference: event.target.value })
                          }
                          className={clsx(
                            "min-w-0 flex-1",
                            (check?.found === false || duplicate) && "border-(--danger)",
                          )}
                        />
                        <span className="flex h-10 w-7 shrink-0 items-center justify-center">
                          {checking && row.reference.trim() && !check ? (
                            <Spinner className="text-(--text-3)" />
                          ) : check?.found ? (
                            <>
                              <CheckIcon className="h-4 w-4 text-(--accent)" />
                              <span className="sr-only">পাওয়া গেছে</span>
                            </>
                          ) : check ? (
                            <>
                              <AlertIcon className="h-4 w-4 text-(--danger)" />
                              <span className="sr-only">পাওয়া যায়নি</span>
                            </>
                          ) : null}
                        </span>
                        <IconButton
                          label="সূত্রটি সরান"
                          onClick={() =>
                            setForm((previous) => ({
                              ...previous,
                              sources: previous.sources.filter((item) => item.id !== row.id),
                            }))
                          }
                          className="hover:text-(--danger)"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                    {duplicate ? (
                      <p className="mt-1 text-xs text-(--danger) sm:ps-[13.5rem]">
                        এই রেফারেন্স তালিকায় একাধিকবার আছে।
                      </p>
                    ) : check && !check.found ? (
                      <p className="mt-1 text-xs text-(--danger) sm:ps-[13.5rem]">
                        {check.foundSourceType
                          ? `রেফারেন্সটি ${SOURCE_NAMES[check.foundSourceType]} উৎসে আছে, উৎস বদলে দিন।`
                          : "দলিল ভান্ডারে এই রেফারেন্স পাওয়া যায়নি। বানান ও নম্বর মিলিয়ে দেখুন।"}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
          <Button
            size="sm"
            className="mt-4"
            icon={<PlusIcon className="h-4 w-4" />}
            disabled={form.sources.length >= MAX_SOURCES}
            onClick={() =>
              setForm((previous) => ({
                ...previous,
                sources: [
                  ...previous.sources,
                  sourceRow(previous.sources.at(-1)?.sourceType ?? "quran", ""),
                ],
              }))
            }
          >
            সূত্র যোগ করুন
          </Button>
        </Card>
      </div>

      <SaveBar
        dirty={dirty}
        message={
          missing.length > 0
            ? `${formatCount(missing.length)}টি রেফারেন্স পাওয়া যায়নি।`
            : dirty && (!body.question || !body.answer)
              ? "প্রশ্ন ও উত্তর দুটোই দিতে হবে।"
              : undefined
        }
      >
        {id ? (
          <Button
            onClick={() => setSource(null)}
            disabled={!dirty || saving}
            className="w-full sm:w-auto"
          >
            বাতিল
          </Button>
        ) : (
          <Link
            href="/admin/answers"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-(--border) px-4 text-sm font-medium text-(--text-1) hover:bg-(--surface-2) sm:w-auto"
          >
            বাতিল
          </Link>
        )}
        <Button
          tone="primary"
          onClick={() => void save()}
          loading={saving}
          disabled={!canSave}
          className="w-full sm:w-auto"
        >
          {id ? "হালনাগাদ করুন" : "যোগ করুন"}
        </Button>
      </SaveBar>

      {id ? (
        <ConfirmDialog
          open={deleteOpen}
          title="উত্তরটি মুছে ফেলবেন?"
          message="মুছে ফেললে এই প্রশ্নে আবার মডেল দিয়ে নতুন উত্তর তৈরি হবে। এটি ফেরত আনা যাবে না।"
          confirmLabel="মুছে ফেলুন"
          busy={deleting}
          onClose={closeDelete}
          onConfirm={() => void remove()}
        />
      ) : null}
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/answers"
      className="mb-3 inline-flex items-center gap-1 text-sm text-(--text-2) hover:text-(--text-1)"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      সব যাচাইকৃত উত্তর
    </Link>
  );
}
