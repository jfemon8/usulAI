"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AdminApiError, adminApi, errorMessage } from "@/components/admin/api";
import { useToast } from "@/components/admin/Dialog";
import { SOURCE_NAMES } from "@/components/admin/labels";
import { Toggle } from "@/components/admin/site/FormBits";
import {
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Select,
  Spinner,
  formatCount,
} from "@/components/admin/ui";
import { RichTextField } from "@/components/editor/RichTextField";
import { AlertIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import { HELP_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import type { HelpActionResponse, HelpContextSource, HelpDetail } from "@/lib/help/types";
import type { SourceType } from "@/types";

const MAX_SOURCES = 20;

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

let rowCounter = 0;

function sourceRow(sourceType: SourceType, reference: string): SourceRow {
  rowCounter += 1;
  return { id: rowCounter, sourceType, reference };
}

function checkKey(sourceType: SourceType, reference: string): string {
  return `${sourceType}|${reference.trim()}`;
}

export function HelpAnswerEditor({
  detail,
  onSaved,
  onCancel,
}: {
  detail: HelpDetail;
  onSaved: (response: HelpActionResponse) => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const editing = detail.status === "answered";
  const [answer, setAnswer] = useState(detail.answer ?? "");
  const [rows, setRows] = useState<SourceRow[]>(() =>
    detail.sources.map((source) => sourceRow(source.sourceType, source.reference)),
  );
  const [checks, setChecks] = useState<Map<string, ReferenceCheck>>(
    () =>
      new Map(
        detail.sources.map((source) => [
          checkKey(source.sourceType, source.reference),
          { sourceType: source.sourceType, reference: source.reference, found: true },
        ]),
      ),
  );
  const [publish, setPublish] = useState(detail.published);
  const [masalaQuestion, setMasalaQuestion] = useState(detail.question);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const sources = rows
    .filter((row) => row.reference.trim())
    .map((row) => ({ sourceType: row.sourceType, reference: row.reference.trim() }));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const source of sources) {
    const key = checkKey(source.sourceType, source.reference);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  const missing = sources.filter(
    (source) => checks.get(checkKey(source.sourceType, source.reference))?.found === false,
  );
  const answerError =
    answer.trim().length > HELP_CONFIG.maxAnswerChars
      ? `সর্বোচ্চ ${formatCount(HELP_CONFIG.maxAnswerChars)} অক্ষর।`
      : null;
  const trimmedMasalaQuestion = masalaQuestion.trim();
  const masalaQuestionFits =
    trimmedMasalaQuestion.length > 0 &&
    trimmedMasalaQuestion.length <= HELP_CONFIG.maxQuestionChars;
  const masalaError = !publish
    ? null
    : !trimmedMasalaQuestion
      ? "মাসআলার প্রশ্নটি লিখুন।"
      : !masalaQuestionFits
        ? `সর্বোচ্চ ${formatCount(HELP_CONFIG.maxQuestionChars)} অক্ষর।`
        : null;
  const canSave =
    answer.trim().length > 0 &&
    !answerError &&
    !masalaError &&
    duplicates.size === 0 &&
    missing.length === 0;

  const contextSources: HelpContextSource[] = detail.context.resolved.filter(
    (source) =>
      !sources.some(
        (item) => item.sourceType === source.sourceType && item.reference === source.reference,
      ),
  );

  function updateRow(id: number, update: Partial<SourceRow>) {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...update } : row)));
  }

  function addContextSources() {
    const room = MAX_SOURCES - rows.length;
    const additions = contextSources.slice(0, Math.max(0, room));
    setRows((previous) => [
      ...previous.filter((row) => row.reference.trim()),
      ...additions.map((source) => sourceRow(source.sourceType, source.reference)),
    ]);
    setChecks((previous) => {
      const next = new Map(previous);
      for (const source of additions) {
        next.set(checkKey(source.sourceType, source.reference), { ...source, found: true });
      }
      return next;
    });
  }

  async function checkReferences() {
    if (sources.length === 0) return;
    setChecking(true);
    try {
      const result = await adminApi<{ checks: ReferenceCheck[] }>("/api/admin/help/references", {
        method: "POST",
        body: { sources },
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
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setChecking(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const response = await adminApi<HelpActionResponse>(`/api/admin/help/${detail.id}`, {
        method: "PATCH",
        body: {
          action: "answer",
          answer: answer.trim(),
          sources,
          publish,
          ...(masalaQuestionFits ? { masalaQuestion: trimmedMasalaQuestion } : {}),
        },
      });
      onSaved(response);
    } catch (failure) {
      toast.error(errorMessage(failure));
      if (failure instanceof AdminApiError && failure.status === 422) void checkReferences();
    } finally {
      setSaving(false);
    }
  }

  const editorSources = sources.map((source, index) => ({
    index: index + 1,
    reference: `${SOURCE_NAMES[source.sourceType]}: ${source.reference}`,
  }));

  return (
    <Card
      title={editing ? "উত্তর সম্পাদনা" : "উত্তর লিখুন"}
      description="টুলবার দিয়ে বিন্যাস করুন। সূত্রের নম্বর [1], [2] নিচের তালিকার ক্রম অনুযায়ী, টুলবারের সূত্র বোতাম থেকেও বসানো যায়।"
    >
      <div className="flex flex-col gap-5">
        <div>
          <RichTextField
            value={answer}
            onChange={setAnswer}
            label="উত্তরের লেখা"
            placeholder="প্রশ্নকারীর জন্য উত্তর লিখুন…"
            minHeight={256}
            maxLength={HELP_CONFIG.maxAnswerChars}
            invalid={Boolean(answerError)}
            sources={editorSources}
          />
          {answerError ? (
            <p className="mt-2 text-xs leading-5 text-(--danger)">{answerError}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-(--border) pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-(--text-1)">সূত্র</p>
              <p className="mt-0.5 text-xs leading-5 text-(--text-3)">
                দলিল ভান্ডারের রেফারেন্স হুবহু লিখুন, যেমন &quot;Al-Baqara 2:255&quot; বা &quot;সহীহ
                বুখারী 1&quot;। সর্বোচ্চ {formatCount(MAX_SOURCES)}টি।
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {contextSources.length > 0 ? (
                <Button size="sm" onClick={addContextSources} disabled={rows.length >= MAX_SOURCES}>
                  AI উত্তরের {formatCount(contextSources.length)}টি সূত্র যোগ করুন
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={() => void checkReferences()}
                loading={checking}
                disabled={sources.length === 0}
              >
                যাচাই করুন
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl bg-(--surface-2) px-4 py-3 text-sm text-(--text-2)">
              কোনো সূত্র নেই। সূত্রসহ উত্তর পাঠকের কাছে বেশি নির্ভরযোগ্য, তাই সম্ভব হলে অন্তত একটি
              সূত্র দিন।
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {rows.map((row, index) => {
                const key = checkKey(row.sourceType, row.reference);
                const check = row.reference.trim() ? checks.get(key) : undefined;
                const duplicate = duplicates.has(key);
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
                            updateRow(row.id, { sourceType: event.target.value as SourceType })
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
                          onChange={(event) => updateRow(row.id, { reference: event.target.value })}
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
                            setRows((previous) => previous.filter((item) => item.id !== row.id))
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
            className="self-start"
            icon={<PlusIcon className="h-4 w-4" />}
            disabled={rows.length >= MAX_SOURCES}
            onClick={() =>
              setRows((previous) => [
                ...previous,
                sourceRow(previous.at(-1)?.sourceType ?? "quran", ""),
              ])
            }
          >
            সূত্র যোগ করুন
          </Button>
        </div>

        <div className="flex flex-col gap-3 border-t border-(--border) pt-4">
          <Toggle
            checked={publish}
            onChange={setPublish}
            label="মাসআলা হিসেবেও প্রকাশ করুন"
            description={
              detail.masalaId && !publish
                ? "বন্ধ করলে আগে প্রকাশিত মাসআলাটি তালিকা থেকে সরে যাবে, তবে যাচাইকৃত উত্তর হিসেবে থেকে যাবে।"
                : "উত্তরটি আপনার নামসহ মাসআলা পাতায় সবার জন্য দেখানো হবে। প্রশ্নকারীর নাম বা ইমেইল প্রকাশ হয় না।"
            }
          />
          {publish ? (
            <Field
              label="মাসআলার প্রশ্ন"
              hint="প্রশ্নকারীর ব্যক্তিগত তথ্য থাকলে সরিয়ে সবার উপযোগী করে লিখুন।"
              error={masalaError}
            >
              {(fieldId) => (
                <Input
                  id={fieldId}
                  dir="auto"
                  value={masalaQuestion}
                  onChange={(event) => setMasalaQuestion(event.target.value)}
                />
              )}
            </Field>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-(--border) pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-(--text-3)" aria-live="polite">
            {missing.length > 0
              ? `${formatCount(missing.length)}টি রেফারেন্স পাওয়া যায়নি।`
              : editing
                ? "সম্পাদনা করলে প্রশ্নকারীকে আবার ইমেইল পাঠানো হয় না।"
                : "পাঠানোর পর প্রশ্নকারী ট্র্যাকিং লিংকে উত্তর দেখবেন, ইমেইল দিলে জানানো হবে।"}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {onCancel ? (
              <Button onClick={onCancel} disabled={saving} className="w-full sm:w-auto">
                বাতিল
              </Button>
            ) : null}
            <Button
              tone="primary"
              onClick={() => void save()}
              loading={saving}
              disabled={!canSave}
              className="w-full sm:w-auto"
            >
              {editing ? "উত্তর হালনাগাদ করুন" : "উত্তর পাঠান"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
