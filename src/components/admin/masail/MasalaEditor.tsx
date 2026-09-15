"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AdminApiError, adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import {
  AnswerWriter,
  AuthorLine,
  MASALA_LIMITS,
  PublishBadge,
  SourcesEditor,
  duplicateSourceKeys,
  foundChecks,
  missingSources,
  rowsFromSources,
  sourcePayload,
  useReferenceChecks,
  type SourceRow,
} from "@/components/admin/masail/MasalaFields";
import type { WorkspaceMasalaDetail } from "@/components/admin/masail/types";
import { CharCount, SaveBar, Toggle, useUnsavedWarning } from "@/components/admin/site/FormBits";
import {
  Button,
  Card,
  Field,
  Input,
  LoadError,
  Notice,
  PageHeader,
  Skeleton,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { SourceCitationList } from "@/components/chat/SourceCitation";
import { RichContent } from "@/components/editor/RichContent";
import { ChevronLeftIcon, ExternalLinkIcon, TrashIcon } from "@/components/ui/Icons";
import { RATE_LIMIT_CONFIG } from "@/config/site";
import type { PrincipalView } from "@/lib/admin/roles";

interface FormState {
  question: string;
  answer: string;
  published: boolean;
  reviewerNote: string;
  sources: SourceRow[];
}

function toForm(detail: WorkspaceMasalaDetail | null): FormState {
  return {
    question: detail?.question ?? "",
    answer: detail?.answer ?? "",
    published: detail?.published ?? false,
    reviewerNote: detail?.reviewerNote ?? "",
    sources: rowsFromSources(detail?.sources ?? []),
  };
}

function payload(form: FormState) {
  return {
    question: form.question.trim(),
    answer: form.answer.trim(),
    published: form.published,
    reviewerNote: form.reviewerNote.trim(),
    sources: sourcePayload(form.sources),
  };
}

function BackLink() {
  return (
    <Link
      href="/admin/masail"
      className="mb-3 inline-flex items-center gap-1 text-sm text-(--text-2) hover:text-(--text-1)"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      সব মাসআলা
    </Link>
  );
}

function MetaLine({ data }: { data: WorkspaceMasalaDetail }) {
  return (
    <div className="-mt-2 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-(--text-3)">
      <PublishBadge published={data.published} />
      <span>
        লেখক: <AuthorLine author={data.author} />
      </span>
      <span>চ্যাটে দেখানো হয়েছে {formatCount(data.servedCount)} বার</span>
      <span>তৈরি {formatWhen(data.createdAt)}</span>
      {data.updatedAt ? (
        <span>
          হালনাগাদ {formatWhen(data.updatedAt)}
          {data.updatedBy ? `, ${data.updatedBy}` : ""}
        </span>
      ) : null}
      {data.path ? (
        <a
          href={data.path}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 font-medium text-(--accent) hover:underline"
        >
          প্রকাশিত পাতা
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}

export function MasalaEditor({ id, principal }: { id?: string; principal: PrincipalView }) {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload, replace } = useAdminData<WorkspaceMasalaDetail>(
    id ? `/api/admin/masail/${id}` : null,
  );
  const [source, setSource] = useState<WorkspaceMasalaDetail | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(null));
  const [baseline, setBaseline] = useState(() => JSON.stringify(payload(toForm(null))));
  const references = useReferenceChecks();
  const { checks, setChecks, checking } = references;
  const [conflict, setConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const closeDelete = useCallback(() => setDeleteOpen(false), []);

  if (data && data !== source) {
    const next = toForm(data);
    setSource(data);
    setForm(next);
    setBaseline(JSON.stringify(payload(next)));
    setChecks(foundChecks(data.sources));
    setConflict(null);
  }

  const body = payload(form);
  const dirty = JSON.stringify(body) !== baseline;
  useUnsavedWarning(dirty && !saving);

  if (id && error && !data) {
    return (
      <>
        <BackLink />
        <PageHeader title="মাসআলা" />
        <LoadError message={error} onRetry={reload} />
      </>
    );
  }

  if (id && (loading || !data)) {
    return (
      <>
        <BackLink />
        <PageHeader title="মাসআলা" />
        <Skeleton rows={6} />
      </>
    );
  }

  if (data && !data.canEdit) {
    return (
      <>
        <BackLink />
        <PageHeader title="মাসআলা" description="অন্য আলেমের প্রকাশিত মাসআলা, শুধু পড়া যাবে।" />
        <MetaLine data={data} />
        <div className="flex flex-col gap-5">
          <Card title="প্রশ্ন">
            <p className="text-base break-words text-(--text-1)" dir="auto">
              {data.question}
            </p>
          </Card>
          <Card title="উত্তর">
            <RichContent text={data.answer} />
            <SourceCitationList sources={data.sources} />
          </Card>
        </div>
      </>
    );
  }

  const questionError =
    body.question.length > RATE_LIMIT_CONFIG.maxQuestionChars
      ? `সর্বোচ্চ ${formatCount(RATE_LIMIT_CONFIG.maxQuestionChars)} অক্ষর।`
      : null;
  const noteError =
    body.reviewerNote.length > MASALA_LIMITS.noteChars
      ? `সর্বোচ্চ ${formatCount(MASALA_LIMITS.noteChars)} অক্ষর।`
      : null;
  const duplicates = duplicateSourceKeys(form.sources);
  const missing = missingSources(form.sources, checks);
  const canSave =
    dirty &&
    body.question.length > 0 &&
    body.answer.length > 0 &&
    body.answer.length <= MASALA_LIMITS.answerChars &&
    !questionError &&
    !noteError &&
    duplicates.size === 0 &&
    missing.length === 0;

  function patch(update: Partial<FormState>) {
    setForm((previous) => ({ ...previous, ...update }));
  }

  async function save() {
    setSaving(true);
    setConflict(null);
    try {
      const saved = await adminApi<WorkspaceMasalaDetail>(
        id ? `/api/admin/masail/${id}` : "/api/admin/masail",
        { method: id ? "PUT" : "POST", body },
      );
      if (id) {
        replace(saved);
        toast.success("মাসআলাটি হালনাগাদ হয়েছে।");
      } else {
        setBaseline(JSON.stringify(body));
        toast.success(
          saved.published ? "মাসআলাটি সংরক্ষিত ও প্রকাশিত হয়েছে।" : "মাসআলাটি সংরক্ষিত হয়েছে।",
        );
        router.replace(`/admin/masail/${saved.id}`);
      }
    } catch (failure) {
      if (failure instanceof AdminApiError && failure.status === 409) {
        setConflict(failure.message);
      } else {
        toast.error(errorMessage(failure));
      }
      if (failure instanceof AdminApiError && failure.status === 422) {
        void references.check(body.sources);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id) return;
    setDeleting(true);
    try {
      await adminApi(`/api/admin/masail/${id}`, { method: "DELETE" });
      setBaseline(JSON.stringify(body));
      toast.success("মাসআলাটি মুছে ফেলা হয়েছে।");
      router.push("/admin/masail");
    } catch (failure) {
      toast.error(errorMessage(failure));
      setDeleting(false);
    }
  }

  const editingOther = data?.author && data.author.id !== principal.id ? data.author : null;

  return (
    <>
      <BackLink />
      <PageHeader
        title={id ? "মাসআলা সম্পাদনা" : "নতুন মাসআলা"}
        description="প্রশ্নটি হুবহু বা একই বিষয়ে চ্যাটে এলে এই উত্তর আপনার নামসহ দেখানো হবে। প্রতিটি সূত্র দলিল ভান্ডারে থাকতে হবে।"
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

      {data ? <MetaLine data={data} /> : null}

      <div className="flex flex-col gap-5">
        {editingOther ? (
          <Notice tone="warn">
            আপনি {editingOther.category} {editingOther.name} এর মাসআলা সম্পাদনা করছেন। লেখকের নাম
            বদলাবে না, আপনার নাম হালনাগাদকারী হিসেবে থাকবে।
          </Notice>
        ) : null}
        {conflict ? <Notice tone="danger">{conflict}</Notice> : null}

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
                  dir="auto"
                  value={form.question}
                  onChange={(event) => patch({ question: event.target.value })}
                  placeholder="যেমন: সফরে কসর নামাজ কত দিন পড়া যাবে?"
                />
              )}
            </Field>
            <Toggle
              checked={form.published}
              onChange={(published) => patch({ published })}
              label="পাবলিক মাসআলা পাতায় প্রকাশ করুন"
              description="বন্ধ থাকলেও চ্যাটে একই প্রশ্নে এই উত্তর দেখানো হবে, শুধু পাবলিক তালিকায় আসবে না।"
            />
          </div>
        </Card>

        <AnswerWriter
          value={form.answer}
          onChange={(answer) => patch({ answer })}
          sources={form.sources}
        />

        <SourcesEditor
          rows={form.sources}
          onChange={(sources) => patch({ sources })}
          checks={checks}
          checking={checking}
          onCheck={() => void references.check(body.sources)}
        />

        <Card>
          <Field
            label="অভ্যন্তরীণ নোট (ঐচ্ছিক)"
            hint={
              <>
                শুধু প্যানেলে দেখা যায়।{" "}
                <CharCount value={form.reviewerNote} max={MASALA_LIMITS.noteChars} />
              </>
            }
            error={noteError}
          >
            {(fieldId) => (
              <Input
                id={fieldId}
                dir="auto"
                value={form.reviewerNote}
                onChange={(event) => patch({ reviewerNote: event.target.value })}
              />
            )}
          </Field>
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
            href="/admin/masail"
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
          {id ? "হালনাগাদ করুন" : "সংরক্ষণ করুন"}
        </Button>
      </SaveBar>

      {id ? (
        <ConfirmDialog
          open={deleteOpen}
          title="মাসআলাটি মুছে ফেলবেন?"
          message="মুছে ফেললে চ্যাটে এই প্রশ্নের উত্তর আবার AI তৈরি করবে এবং প্রকাশিত পাতা থেকেও সরে যাবে। এটি ফেরত আনা যাবে না।"
          confirmLabel="মুছে ফেলুন"
          busy={deleting}
          onClose={closeDelete}
          onConfirm={() => void remove()}
        />
      ) : null}
    </>
  );
}
