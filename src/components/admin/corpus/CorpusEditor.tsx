"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import { SuggestInput } from "@/components/admin/SuggestInput";
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  LoadError,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { DocumentFlags } from "@/components/admin/corpus/CorpusBadges";
import {
  CORPUS_SOURCE_LABELS,
  type CitationFieldInput,
  type CorpusDocumentView,
  type CorpusEditPayload,
} from "@/components/admin/corpus/types";
import { ChevronLeftIcon, ExternalLinkIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import { SOURCE_PRIORITY } from "@/config/site";
import type { SourceType } from "@/types";

const LIST_PATH = "/admin/corpus";
const CITATION_KEY_SUGGESTIONS = ["url", "page", "pageCount", "media"];
const METADATA_HINT =
  'Extended JSON (relaxed)। তারিখ লিখুন {"$date": "2026-09-15T00:00:00Z"} আকারে। হাদিসের গ্রেড {name, grade} আকারে দেখানো হয়, সংরক্ষণের সময় সংক্ষিপ্ত রূপে রাখা হয়।';
const MIXED_SCRIPT_FONT = "var(--font-sans), var(--font-arabic)";

interface CitationRowState extends CitationFieldInput {
  uid: number;
}

function metadataProblem(text: string): string | null {
  if (!text.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? null
      : "মেটাডেটা অবশ্যই একটি JSON অবজেক্ট ({ ... }) হতে হবে।";
  } catch (error) {
    return `JSON সঠিক নয়: ${error instanceof Error ? error.message : "অজানা সমস্যা"}`;
  }
}

function payloadKey(payload: CorpusEditPayload): string {
  return JSON.stringify([
    payload.sourceType,
    payload.reference,
    payload.content,
    payload.citation.map((row) => [row.key, row.value]),
    payload.metadata,
  ]);
}

function sourceViewHref(reference: string): string {
  return `/api/source-view?ref=${encodeURIComponent(reference)}`;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-(--border) py-2.5 last:border-b-0">
      <dt className="text-xs text-(--text-3)">{label}</dt>
      <dd className="min-w-0 text-sm break-all text-(--text-1)">{children}</dd>
    </div>
  );
}

function CorpusForm({
  initial,
  onSaved,
}: {
  initial: CorpusDocumentView | (CorpusEditPayload & { id: null });
  onSaved?: (view: CorpusDocumentView) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const counter = useRef(initial.citation.length);
  const isNew = initial.id === null;
  const existing = isNew ? null : (initial as CorpusDocumentView);

  const [sourceType, setSourceType] = useState<SourceType>(initial.sourceType);
  const [reference, setReference] = useState(initial.reference);
  const [content, setContent] = useState(initial.content);
  const [citation, setCitation] = useState<CitationRowState[]>(() =>
    initial.citation.map((row, index) => ({ ...row, uid: index })),
  );
  const [metadata, setMetadata] = useState(initial.metadata);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const payload: CorpusEditPayload = {
    sourceType,
    reference,
    content,
    citation: citation.map(({ key, value }) => ({ key, value })),
    metadata,
  };
  const dirty = isNew
    ? Boolean(reference.trim() || content.trim())
    : payloadKey(payload) !==
      payloadKey({
        sourceType: initial.sourceType,
        reference: initial.reference,
        content: initial.content,
        citation: initial.citation,
        metadata: initial.metadata,
      });
  const jsonProblem = metadataProblem(metadata);
  const contentChanged = existing !== null && content.trim() !== existing.content.trim();
  const referenceChanged = existing !== null && reference.trim() !== existing.reference;
  const sourceChanged = existing !== null && sourceType !== existing.sourceType;
  const canSave =
    !saving && !deleting && !jsonProblem && Boolean(reference.trim() && content.trim());

  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function updateCitation(uid: number, patch: Partial<CitationFieldInput>) {
    setCitation((rows) => rows.map((row) => (row.uid === uid ? { ...row, ...patch } : row)));
  }

  function addCitationRow() {
    counter.current += 1;
    const uid = counter.current;
    setCitation((rows) => [...rows, { uid, key: "", value: "" }]);
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setFormError(null);
    try {
      const view = await adminApi<CorpusDocumentView>(
        existing ? `/api/admin/corpus/${existing.id}` : "/api/admin/corpus",
        { method: existing ? "PUT" : "POST", body: payload },
      );
      if (existing) {
        toast.success(
          contentChanged
            ? "দলিল সংরক্ষিত হয়েছে। লেখা বদলেছে, তাই এমবেডিং আবার তৈরি হবে।"
            : "দলিল সংরক্ষিত হয়েছে।",
        );
        setSaving(false);
        onSaved?.(view);
      } else {
        toast.success("নতুন দলিল যোগ হয়েছে।");
        router.replace(`${LIST_PATH}/${view.id}`);
      }
    } catch (error) {
      setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setDeleting(true);
    try {
      await adminApi(`/api/admin/corpus/${existing.id}`, { method: "DELETE" });
      toast.success("দলিলটি মুছে ফেলা হয়েছে।");
      router.replace(LIST_PATH);
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <PageHeader
        title={existing ? "দলিল সম্পাদনা" : "নতুন দলিল"}
        description={
          existing ? (
            <span dir="auto" className="break-words">
              {existing.reference}
            </span>
          ) : (
            "নতুন দলিল এমবেডিং ছাড়া যোগ হয়। কেউ প্রশ্ন করলে বা ingestion চালালে পরে এমবেডিং তৈরি হবে।"
          )
        }
        actions={
          <>
            <Link
              href={LIST_PATH}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1)"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              তালিকা
            </Link>
            {existing ? (
              <>
                <a
                  href={sourceViewHref(existing.reference)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-(--border) px-3 text-sm text-(--text-1) transition hover:bg-(--surface-2)"
                >
                  <ExternalLinkIcon className="h-4 w-4" />
                  উৎস দেখুন
                </a>
                <Button
                  size="sm"
                  tone="ghost"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving || deleting}
                  icon={<TrashIcon className="h-4 w-4" />}
                  className="text-(--danger) hover:text-(--danger)"
                >
                  মুছুন
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <form onSubmit={(event) => void save(event)} noValidate>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-5">
          <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
            {formError ? <Notice tone="danger">{formError}</Notice> : null}

            <Card title="পরিচয়">
              <div className="grid gap-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
                <Field
                  label="উৎস"
                  hint={sourceChanged ? "নতুন উৎসেও রেফারেন্সটি অনন্য হতে হবে।" : undefined}
                >
                  {(id) => (
                    <Select
                      id={id}
                      value={sourceType}
                      onChange={(event) => setSourceType(event.target.value as SourceType)}
                    >
                      {SOURCE_PRIORITY.map((source) => (
                        <option key={source} value={source}>
                          {CORPUS_SOURCE_LABELS[source]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field
                  label="রেফারেন্স"
                  hint={
                    referenceChanged
                      ? "রেফারেন্স বদলালে ingestion আবার চালানোর সময় পুরনো রেফারেন্সটি নতুন দলিল হিসেবে ফিরে আসতে পারে।"
                      : "পুরো রেফারেন্স, যেমন সহীহ বুখারী 1454 বা বইয়ের নাম, অধ্যায়, পৃষ্ঠা। একই উৎসে দুটি দলিলের রেফারেন্স এক হতে পারে না।"
                  }
                >
                  {(id) => (
                    <Input
                      id={id}
                      dir="auto"
                      value={reference}
                      maxLength={500}
                      required
                      onChange={(event) => setReference(event.target.value)}
                    />
                  )}
                </Field>
              </div>
            </Card>

            <Card
              title="দলিলের লেখা"
              description="আরবি, বাংলা ও ইংরেজি। কুরআন ও হাদিসে ধরন: আরবি, তারপর বাংলা: ..., তারপর English: ..."
            >
              <div className="flex flex-col gap-3">
                {contentChanged && existing?.embedded ? (
                  <Notice tone="warn">
                    লেখা বদলানো হয়েছে। সংরক্ষণ করলে এই দলিলের এমবেডিং মুছে যাবে এবং পরে আবার তৈরি
                    হবে।
                  </Notice>
                ) : null}
                <Field
                  label="লেখা"
                  hint={`${formatCount([...content].length)} অক্ষর। দিকনির্দেশক অদৃশ্য চিহ্ন সংরক্ষণের সময় বাদ দেওয়া হবে।`}
                >
                  {(id) => (
                    <Textarea
                      id={id}
                      dir="auto"
                      value={content}
                      required
                      spellCheck={false}
                      onChange={(event) => setContent(event.target.value)}
                      className="min-h-88 resize-y sm:min-h-112"
                      style={{
                        fontFamily: MIXED_SCRIPT_FONT,
                        fontSize: "1.0625rem",
                        lineHeight: 2,
                        unicodeBidi: "plaintext",
                      }}
                    />
                  )}
                </Field>
              </div>
            </Card>

            <Card
              title="সূত্রের ঘর"
              description="রেফারেন্স ও উৎস ছাড়া বাকি ঘর। খালি মানের ঘর সংরক্ষণ হয় না।"
              actions={
                <Button size="sm" onClick={addCitationRow} icon={<PlusIcon className="h-4 w-4" />}>
                  ঘর যোগ করুন
                </Button>
              }
            >
              {citation.length === 0 ? (
                <p className="text-sm text-(--text-3)">
                  কোনো বাড়তি ঘর নেই। কুরআনের quran.com লিংক ও বইয়ের পৃষ্ঠা মেটাডেটা থেকে নিজে
                  থেকেই তৈরি হয়।
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  <li
                    aria-hidden="true"
                    className="hidden grid-cols-[10rem_minmax(0,1fr)_2.5rem] gap-2 text-xs text-(--text-3) sm:grid"
                  >
                    <span>নাম</span>
                    <span>মান</span>
                  </li>
                  {citation.map((row) => (
                    <li
                      key={row.uid}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-(--border) p-2.5 sm:grid-cols-[10rem_minmax(0,1fr)_2.5rem] sm:border-0 sm:p-0"
                    >
                      <SuggestInput
                        aria-label="ঘরের নাম"
                        dir="ltr"
                        value={row.key}
                        maxLength={40}
                        placeholder="নাম"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        suggestions={CITATION_KEY_SUGGESTIONS.filter(
                          (key) =>
                            !citation.some((item) => item.uid !== row.uid && item.key === key),
                        )}
                        onValueChange={(key) => updateCitation(row.uid, { key })}
                        className="font-mono"
                      />
                      <IconButton
                        label={`${row.key || "ঘরটি"} মুছুন`}
                        onClick={() =>
                          setCitation((rows) => rows.filter((item) => item.uid !== row.uid))
                        }
                        className="text-(--danger) sm:order-3"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                      <Input
                        aria-label={`${row.key || "ঘরের"} মান`}
                        dir="auto"
                        value={row.value}
                        placeholder="মান"
                        onChange={(event) => updateCitation(row.uid, { value: event.target.value })}
                        className="col-span-2 sm:order-2 sm:col-span-1"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="মেটাডেটা" description={METADATA_HINT}>
              <Field label="মেটাডেটা JSON" error={jsonProblem}>
                {(id) => (
                  <Textarea
                    id={id}
                    dir="ltr"
                    value={metadata}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-invalid={jsonProblem ? true : undefined}
                    onChange={(event) => setMetadata(event.target.value)}
                    className={clsx(
                      "min-h-64 resize-y font-mono sm:min-h-80",
                      jsonProblem && "border-(--danger)",
                    )}
                    style={{ fontSize: "0.8125rem", lineHeight: 1.7, tabSize: 2 }}
                  />
                )}
              </Field>
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 lg:gap-5">
            <Card title="তথ্য">
              {existing ? (
                <dl>
                  <InfoRow label="আইডি">
                    <span className="font-mono text-xs">{existing.id}</span>
                  </InfoRow>
                  <InfoRow label="অবস্থা">
                    <DocumentFlags
                      embedded={existing.embedded}
                      adminEdited={existing.adminEdited}
                      restricted={existing.restricted}
                    />
                  </InfoRow>
                  <InfoRow label="এমবেডিং মডেল">
                    {existing.embeddingModel ? (
                      <span className="font-mono text-xs">{existing.embeddingModel}</span>
                    ) : (
                      "নেই"
                    )}
                  </InfoRow>
                  <InfoRow label="contentHash">
                    {existing.contentHash ? (
                      <span className="font-mono text-xs">{existing.contentHash}</span>
                    ) : (
                      "নেই"
                    )}
                  </InfoRow>
                  <InfoRow label="সংরক্ষিত (কপিরাইটযুক্ত) বই">
                    {existing.restricted ? <Badge tone="danger">হ্যাঁ</Badge> : "না"}
                  </InfoRow>
                  <InfoRow label="শেষ অ্যাডমিন সম্পাদনা">
                    {existing.adminEdited ? formatWhen(existing.adminEditedAt) : "হয়নি"}
                  </InfoRow>
                </dl>
              ) : (
                <p className="text-sm leading-6 text-(--text-3)">
                  সংরক্ষণের পর আইডি, এমবেডিং ও contentHash এখানে দেখা যাবে।
                </p>
              )}
            </Card>
            <Notice>
              অ্যাডমিন সম্পাদিত বা যোগ করা দলিল ingestion আর বদলায় না এবং উৎস থেকে হারিয়ে গেলেও
              মুছে ফেলে না। সংরক্ষিত বইয়ের অবস্থা এখান থেকে বদলানো যায় না।
            </Notice>
          </aside>
        </div>

        <div className="sticky bottom-0 z-30 -mx-4 mt-5 flex items-center gap-2 border-t border-(--border) bg-(--bg)/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:mb-2 sm:rounded-2xl sm:border sm:px-4 sm:pb-3 sm:shadow-lg">
          <p
            className={clsx(
              "hidden min-w-0 flex-1 truncate text-sm sm:block",
              dirty ? "text-(--warn)" : "text-(--text-3)",
            )}
            aria-live="polite"
          >
            {dirty ? "সংরক্ষণ করা হয়নি এমন পরিবর্তন আছে" : "কোনো পরিবর্তন নেই"}
          </p>
          <Link
            href={LIST_PATH}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-(--border) px-4 text-sm font-medium text-(--text-1) transition hover:bg-(--surface-2) sm:flex-none"
          >
            বাতিল
          </Link>
          <Button
            type="submit"
            tone="primary"
            loading={saving}
            disabled={!canSave || (!isNew && !dirty)}
            className="flex-[2] sm:flex-none"
          >
            {isNew ? "দলিল যোগ করুন" : "সংরক্ষণ করুন"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="দলিলটি মুছে ফেলবেন?"
        confirmLabel="স্থায়ীভাবে মুছুন"
        busy={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
        message={
          <div className="flex flex-col gap-2">
            <p dir="auto" className="font-medium break-words text-(--text-1)">
              {existing?.reference}
            </p>
            <p>দলিলটি ডাটাবেস থেকে স্থায়ীভাবে মুছে যাবে, এমবেডিংসহ। এটি ফেরানো যাবে না।</p>
            <p className="text-(--warn)">
              সতর্কতা: এই উৎসের ingestion আবার চালালে একই রেফারেন্স আবার যোগ হতে পারে, যদি না উৎস
              ফাইল বা API থেকে দলিলটি বাদ পড়ে। মুছে ফেলার পর ingestion-এর কাছে রক্ষা করার মতো কিছু
              থাকে না। দলিলটি শুধু লুকাতে চাইলে মুছে না ফেলে লেখা সম্পাদনা করুন।
            </p>
          </div>
        }
      />
    </>
  );
}

function ExistingDocument({ id }: { id: string }) {
  const { data, error, reload, replace } = useAdminData<CorpusDocumentView>(
    `/api/admin/corpus/${encodeURIComponent(id)}`,
  );
  const [revision, setRevision] = useState(0);

  if (!data) {
    return (
      <>
        <PageHeader
          title="দলিল সম্পাদনা"
          actions={
            <Link
              href={LIST_PATH}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-(--text-2) transition hover:bg-(--surface-2) hover:text-(--text-1)"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              তালিকা
            </Link>
          }
        />
        {error ? <LoadError message={error} onRetry={reload} /> : <Skeleton rows={6} />}
      </>
    );
  }

  return (
    <CorpusForm
      key={`${data.id}:${revision}`}
      initial={data}
      onSaved={(view) => {
        replace(view);
        setRevision((value) => value + 1);
      }}
    />
  );
}

export function CorpusEditor({
  id,
  initialSource = "quran",
}: {
  id?: string;
  initialSource?: SourceType;
}) {
  if (id) return <ExistingDocument id={id} />;
  return (
    <CorpusForm
      initial={{
        id: null,
        sourceType: initialSource,
        reference: "",
        content: "",
        citation: [],
        metadata: "{}",
      }}
    />
  );
}
