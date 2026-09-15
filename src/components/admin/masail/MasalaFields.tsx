"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { useToast } from "@/components/admin/Dialog";
import { SOURCE_NAMES } from "@/components/admin/labels";
import {
  Button,
  Card,
  IconButton,
  Input,
  Select,
  Spinner,
  formatCount,
} from "@/components/admin/ui";
import { RichTextField } from "@/components/editor/RichTextField";
import { AlertIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import { SOURCE_PRIORITY } from "@/config/site";
import type { AnswerSource, SourceType } from "@/types";

export const MASALA_LIMITS = {
  answerChars: 20_000,
  noteChars: 1_000,
  maxSources: 20,
} as const;

export interface SourceRow {
  id: number;
  sourceType: SourceType;
  reference: string;
}

export interface ReferenceCheck {
  sourceType: SourceType;
  reference: string;
  found: boolean;
  foundSourceType?: SourceType;
}

let sourceCounter = 0;

export function sourceRow(sourceType: SourceType, reference: string): SourceRow {
  sourceCounter += 1;
  return { id: sourceCounter, sourceType, reference };
}

export function rowsFromSources(
  sources: readonly Pick<AnswerSource, "sourceType" | "reference">[],
) {
  return sources.map((source) => sourceRow(source.sourceType, source.reference));
}

export function checkKey(sourceType: SourceType, reference: string): string {
  return `${sourceType}|${reference.trim()}`;
}

export function sourcePayload(rows: readonly SourceRow[]) {
  return rows
    .filter((row) => row.reference.trim())
    .map((row) => ({ sourceType: row.sourceType, reference: row.reference.trim() }));
}

export function foundChecks(
  sources: readonly Pick<AnswerSource, "sourceType" | "reference">[],
): Map<string, ReferenceCheck> {
  return new Map(
    sources.map((item) => [
      checkKey(item.sourceType, item.reference),
      { sourceType: item.sourceType, reference: item.reference, found: true },
    ]),
  );
}

export function duplicateSourceKeys(rows: readonly SourceRow[]): Set<string> {
  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.reference.trim()) continue;
    const key = checkKey(row.sourceType, row.reference);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates;
}

export function useReferenceChecks(initial?: () => Map<string, ReferenceCheck>) {
  const toast = useToast();
  const [checks, setChecks] = useState<Map<string, ReferenceCheck>>(initial ?? (() => new Map()));
  const [checking, setChecking] = useState(false);

  const check = useCallback(
    async (sources: { sourceType: SourceType; reference: string }[]): Promise<boolean> => {
      if (sources.length === 0) return true;
      setChecking(true);
      try {
        const result = await adminApi<{ checks: ReferenceCheck[] }>(
          "/api/admin/masail/references",
          { method: "POST", body: { sources } },
        );
        setChecks((previous) => {
          const next = new Map(previous);
          for (const item of result.checks) {
            next.set(checkKey(item.sourceType, item.reference), item);
          }
          return next;
        });
        const notFound = result.checks.filter((item) => !item.found).length;
        if (notFound > 0) toast.error(`${formatCount(notFound)}টি রেফারেন্স পাওয়া যায়নি।`);
        else toast.success("সব রেফারেন্স দলিল ভান্ডারে পাওয়া গেছে।");
        return notFound === 0;
      } catch (failure) {
        toast.error(errorMessage(failure));
        return false;
      } finally {
        setChecking(false);
      }
    },
    [toast],
  );

  return { checks, setChecks, checking, check };
}

export function missingSources(rows: readonly SourceRow[], checks: Map<string, ReferenceCheck>) {
  return sourcePayload(rows).filter(
    (item) => checks.get(checkKey(item.sourceType, item.reference))?.found === false,
  );
}

export function AnswerWriter({
  value,
  onChange,
  sources,
  title = "উত্তর",
  rows = 16,
  inDialog = false,
}: {
  value: string;
  onChange: (value: string) => void;
  sources: readonly SourceRow[];
  title?: string;
  rows?: number;
  inDialog?: boolean;
}) {
  const error =
    value.trim().length > MASALA_LIMITS.answerChars
      ? `সর্বোচ্চ ${formatCount(MASALA_LIMITS.answerChars)} অক্ষর।`
      : null;
  const editorSources = sources
    .filter((row) => row.reference.trim())
    .map((row, index) => ({
      index: index + 1,
      reference: `${SOURCE_NAMES[row.sourceType]}: ${row.reference.trim()}`,
    }));

  return (
    <Card
      title={title}
      description="টুলবার দিয়ে বিন্যাস করুন। সূত্রের নম্বর [1], [2] নিচের তালিকার ক্রম অনুযায়ী, টুলবারের সূত্র বোতাম থেকেও বসানো যায়।"
    >
      <RichTextField
        value={value}
        onChange={onChange}
        label="উত্তরের লেখা"
        placeholder="উত্তর লিখুন…"
        minHeight={Math.max(200, rows * 24)}
        maxLength={MASALA_LIMITS.answerChars}
        invalid={Boolean(error)}
        sources={editorSources}
        toolbarOffset={inDialog ? "none" : "header"}
      />
      {error ? <p className="mt-2 text-xs leading-5 text-(--danger)">{error}</p> : null}
    </Card>
  );
}

export function SourcesEditor({
  rows,
  onChange,
  checks,
  checking,
  onCheck,
}: {
  rows: readonly SourceRow[];
  onChange: (rows: SourceRow[]) => void;
  checks: Map<string, ReferenceCheck>;
  checking: boolean;
  onCheck: () => void;
}) {
  const duplicates = duplicateSourceKeys(rows);
  const filled = rows.some((row) => row.reference.trim());

  function update(rowId: number, patch: Partial<SourceRow>) {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  return (
    <Card
      title="সূত্র"
      description={`দলিল ভান্ডারের রেফারেন্স হুবহু লিখুন, যেমন "Al-Baqara 2:255" বা "সহীহ বুখারী 1"। সর্বোচ্চ ${formatCount(MASALA_LIMITS.maxSources)}টি।`}
      actions={
        <Button size="sm" onClick={onCheck} loading={checking} disabled={!filled}>
          যাচাই করুন
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="mb-3 rounded-xl bg-(--surface-2) px-4 py-3 text-sm text-(--text-2)">
          কোনো সূত্র নেই। সূত্র ছাড়া উত্তর পাঠকের কাছে দলিলহীন দেখাবে, তাই অন্তত একটি সূত্র দিন।
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const key = checkKey(row.sourceType, row.reference);
            const result = row.reference.trim() ? checks.get(key) : undefined;
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
                        update(row.id, { sourceType: event.target.value as SourceType })
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
                      dir="auto"
                      value={row.reference}
                      onChange={(event) => update(row.id, { reference: event.target.value })}
                      className={clsx(
                        "min-w-0 flex-1",
                        (result?.found === false || duplicate) && "border-(--danger)",
                      )}
                    />
                    <span className="flex h-10 w-7 shrink-0 items-center justify-center">
                      {checking && row.reference.trim() && !result ? (
                        <Spinner className="text-(--text-3)" />
                      ) : result?.found ? (
                        <>
                          <CheckIcon className="h-4 w-4 text-(--accent)" />
                          <span className="sr-only">পাওয়া গেছে</span>
                        </>
                      ) : result ? (
                        <>
                          <AlertIcon className="h-4 w-4 text-(--danger)" />
                          <span className="sr-only">পাওয়া যায়নি</span>
                        </>
                      ) : null}
                    </span>
                    <IconButton
                      label="সূত্রটি সরান"
                      onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
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
                ) : result && !result.found ? (
                  <p className="mt-1 text-xs text-(--danger) sm:ps-[13.5rem]">
                    {result.foundSourceType
                      ? `রেফারেন্সটি ${SOURCE_NAMES[result.foundSourceType]} উৎসে আছে, উৎস বদলে দিন।`
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
        disabled={rows.length >= MASALA_LIMITS.maxSources}
        onClick={() => onChange([...rows, sourceRow(rows.at(-1)?.sourceType ?? "quran", "")])}
      >
        সূত্র যোগ করুন
      </Button>
    </Card>
  );
}

export function PublishBadge({ published }: { published: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        published ? "bg-(--accent-soft) text-(--accent)" : "bg-(--surface-2) text-(--text-2)",
      )}
    >
      {published ? "প্রকাশিত" : "অপ্রকাশিত"}
    </span>
  );
}

export function AuthorLine({
  author,
}: {
  author: { name: string; category: string } | null | undefined;
}) {
  if (!author) return <span className="text-(--text-3)">অজানা</span>;
  return (
    <span className="break-words">
      {author.category ? `${author.category} ` : ""}
      {author.name}
    </span>
  );
}
