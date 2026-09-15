"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { AdminApiError, adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import {
  Badge,
  Button,
  Card,
  EmptyState,
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
import { VirtualList } from "@/components/admin/VirtualList";
import { SaveBar, useUnsavedWarning } from "@/components/admin/site/FormBits";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  RetryIcon,
  SearchIcon,
} from "@/components/ui/Icons";

interface SurahSummary {
  number: number;
  name: string;
  ayahs: number;
  noteAyahs: number;
  updatedAt: string | null;
}

interface AyahEditable {
  ayah: number;
  arabic: string;
  translation: string;
  footnotes: string;
}

interface SurahForEdit {
  surah: SurahSummary;
  hash: string | null;
  ayahs: AyahEditable[];
}

type NoteEdit = Pick<AyahEditable, "translation" | "footnotes">;

const TRANSLATION_CHARS = 10_000;
const FOOTNOTES_CHARS = 40_000;

function rowsFor(text: string, min: number, max: number): number {
  const lines = text
    .split("\n")
    .reduce((total, line) => total + Math.ceil(line.length / 70 || 1), 0);
  return Math.min(max, Math.max(min, lines));
}

function isChanged(original: AyahEditable, edit: NoteEdit | undefined): boolean {
  return (
    edit !== undefined &&
    (edit.translation.trim() !== original.translation.trim() ||
      edit.footnotes.trim() !== original.footnotes.trim())
  );
}

const AyahRow = memo(function AyahRow({
  ayah,
  edit,
  onEdit,
  onRevert,
}: {
  ayah: AyahEditable;
  edit: NoteEdit | undefined;
  onEdit: (ayah: AyahEditable, field: keyof NoteEdit, value: string) => void;
  onRevert: (ayah: number) => void;
}) {
  const translation = edit?.translation ?? ayah.translation;
  const footnotes = edit?.footnotes ?? ayah.footnotes;
  const changed = isChanged(ayah, edit);
  const tooLong = translation.length > TRANSLATION_CHARS || footnotes.length > FOOTNOTES_CHARS;

  return (
    <article
      aria-label={`আয়াত ${formatCount(ayah.ayah)}`}
      className={clsx(
        "rounded-2xl border p-3.5 sm:p-4",
        changed ? "border-(--accent) bg-(--accent-soft)/40" : "border-(--border)",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-(--surface-2) px-2 text-xs font-medium text-(--text-1) tabular-nums">
            {formatCount(ayah.ayah)}
          </span>
          {changed ? <Badge tone="accent">পরিবর্তিত</Badge> : null}
          {!ayah.translation && !ayah.footnotes ? <Badge tone="warn">নোট নেই</Badge> : null}
        </div>
        {changed ? (
          <Button
            size="sm"
            tone="ghost"
            icon={<RetryIcon className="h-4 w-4" />}
            onClick={() => onRevert(ayah.ayah)}
          >
            আগের মতো
          </Button>
        ) : null}
      </div>
      {ayah.arabic ? (
        <p className="arabic mb-3 text-(--text-2)" dir="rtl" lang="ar">
          {ayah.arabic}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-(--text-2)">অনুবাদ</span>
          <Textarea
            rows={rowsFor(translation, 2, 10)}
            className="min-h-16"
            value={translation}
            onChange={(event) => onEdit(ayah, "translation", event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-(--text-2)">টীকা</span>
          <Textarea
            rows={rowsFor(footnotes, 2, 14)}
            className="min-h-16"
            value={footnotes}
            onChange={(event) => onEdit(ayah, "footnotes", event.target.value)}
          />
        </label>
        {tooLong ? (
          <p className="text-xs text-(--danger)">
            অনুবাদ সর্বোচ্চ {formatCount(TRANSLATION_CHARS)} আর টীকা সর্বোচ্চ{" "}
            {formatCount(FOOTNOTES_CHARS)} অক্ষর।
          </p>
        ) : null}
      </div>
    </article>
  );
});

export function NotesEditor() {
  const toast = useToast();
  const surahList = useAdminData<{ surahs: SurahSummary[] }>("/api/admin/notes");
  const [surah, setSurah] = useState(1);
  const [pendingSurah, setPendingSurah] = useState<number | null>(null);
  const { data, error, loading, reload, replace } = useAdminData<SurahForEdit>(
    `/api/admin/notes/${surah}`,
  );
  const [source, setSource] = useState<SurahForEdit | null>(null);
  const [edits, setEdits] = useState<Record<number, NoteEdit>>({});
  const [typed, setTyped] = useState("");
  const listTopRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  if (data && data !== source) {
    setSource(data);
    setEdits({});
    setConflict(false);
  }

  const current = data && data.surah.number === surah ? data : null;

  const changes = useMemo(() => {
    if (!current) return [];
    return current.ayahs
      .filter((ayah) => isChanged(ayah, edits[ayah.ayah]))
      .map((ayah) => ({
        ayah: ayah.ayah,
        translation: (edits[ayah.ayah]?.translation ?? ayah.translation).trim(),
        footnotes: (edits[ayah.ayah]?.footnotes ?? ayah.footnotes).trim(),
      }));
  }, [current, edits]);

  const dirty = changes.length > 0;
  const tooLong = changes.some(
    (change) =>
      change.translation.length > TRANSLATION_CHARS || change.footnotes.length > FOOTNOTES_CHARS,
  );
  useUnsavedWarning(dirty);

  const onEdit = useCallback((ayah: AyahEditable, field: keyof NoteEdit, value: string) => {
    setEdits((previous) => ({
      ...previous,
      [ayah.ayah]: {
        translation: previous[ayah.ayah]?.translation ?? ayah.translation,
        footnotes: previous[ayah.ayah]?.footnotes ?? ayah.footnotes,
        [field]: value,
      },
    }));
  }, []);

  const onRevert = useCallback((ayah: number) => {
    setEdits((previous) => {
      const next = { ...previous };
      delete next[ayah];
      return next;
    });
  }, []);

  const closeSwitch = useCallback(() => setPendingSurah(null), []);

  const query = typed.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!current) return [];
    if (!query) return current.ayahs;
    const number = Number(
      query.replace(/[\u09E6-\u09EF]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6)),
    );
    return current.ayahs.filter(
      (ayah) =>
        (Number.isInteger(number) && ayah.ayah === number) ||
        ayah.translation.toLowerCase().includes(query) ||
        ayah.footnotes.toLowerCase().includes(query) ||
        ayah.arabic.includes(query),
    );
  }, [current, query]);

  function chooseSurah(next: number) {
    if (next < 1 || next > 114 || next === surah) return;
    if (dirty) {
      setPendingSurah(next);
      return;
    }
    openSurah(next);
  }

  function openSurah(next: number) {
    const top = listTopRef.current?.getBoundingClientRect().top;
    if (top !== undefined && top < 0) window.scrollBy({ top: top - 16 });
    setSurah(next);
    setTyped("");
    setEdits({});
    setPendingSurah(null);
  }

  async function save() {
    if (!current || !dirty) return;
    setSaving(true);
    try {
      const result = await adminApi<SurahForEdit & { changed: number }>(
        `/api/admin/notes/${current.surah.number}`,
        { method: "PUT", body: { baseHash: current.hash, changes } },
      );
      replace(result);
      surahList.reload();
      toast.success(
        result.changed > 0
          ? `${formatCount(result.changed)}টি আয়াতের নোট সংরক্ষিত হয়েছে।`
          : "কোনো পরিবর্তন পাওয়া যায়নি।",
      );
    } catch (failure) {
      if (failure instanceof AdminApiError && failure.status === 409) setConflict(true);
      toast.error(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  const surahs = surahList.data?.surahs ?? [];
  const summary = surahs.find((item) => item.number === surah) ?? current?.surah;

  return (
    <>
      <PageHeader
        title="কুরআনের নোট"
        description="ড. আবু বকর মুহাম্মাদ যাকারিয়ার বাংলা অনুবাদ ও টীকা (QuranEnc.com), উত্তরে তাফসীরি টীকা হিসেবে যায়।"
      />

      <div className="mb-5">
        <Notice tone="warn">
          QuranEnc-এর লাইসেন্স অনুযায়ী এই অনুবাদ কোনো পরিবর্তন ছাড়া প্রকাশ করতে হয়। তাই শুধু ভাঙা
          অক্ষর, কাটা শব্দ বা আমদানির ভুল ঠিক করুন; অর্থ বা বক্তব্য বদলাবেন না।
        </Notice>
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-(--border) p-3 sm:p-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <IconButton
              label="আগের সূরা"
              onClick={() => chooseSurah(surah - 1)}
              disabled={surah <= 1}
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </IconButton>
            <Select
              aria-label="সূরা বাছাই করুন"
              value={surah}
              onChange={(event) => chooseSurah(Number(event.target.value))}
              className="min-w-0 flex-1"
            >
              {(surahs.length > 0
                ? surahs
                : Array.from({ length: 114 }, (_, index) => ({
                    number: index + 1,
                    name: "",
                    ayahs: 0,
                    noteAyahs: 0,
                    updatedAt: null,
                  }))
              ).map((item) => (
                <option key={item.number} value={item.number}>
                  {formatCount(item.number)}. {item.name || "সূরা"}
                  {item.ayahs ? ` (${formatCount(item.ayahs)} আয়াত)` : ""}
                </option>
              ))}
            </Select>
            <IconButton
              label="পরের সূরা"
              onClick={() => chooseSurah(surah + 1)}
              disabled={surah >= 114}
            >
              <ChevronRightIcon className="h-5 w-5" />
            </IconButton>
          </div>
          <div className="relative min-w-0 md:w-72">
            <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-3)" />
            <Input
              type="search"
              aria-label="এই সূরায় খুঁজুন"
              placeholder="আয়াত নম্বর বা লেখা খুঁজুন"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="ps-9 pe-10"
            />
            {typed ? (
              <IconButton
                label="খোঁজা মুছুন"
                onClick={() => setTyped("")}
                className="absolute end-0.5 top-1/2 h-9 w-9 -translate-y-1/2"
              >
                <CloseIcon className="h-4 w-4" />
              </IconButton>
            ) : null}
          </div>
        </div>

        {summary ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-(--border) px-3 py-2.5 text-xs text-(--text-3) sm:px-4">
            <span>
              নোট আছে {formatCount(summary.noteAyahs)} / {formatCount(summary.ayahs)} আয়াতে
            </span>
            <span>সর্বশেষ হালনাগাদ {formatWhen(summary.updatedAt)}</span>
            {surahList.error ? <span className="text-(--danger)">{surahList.error}</span> : null}
          </div>
        ) : null}

        <div ref={listTopRef} className="p-3 sm:p-4">
          {conflict ? (
            <div className="mb-4">
              <Notice
                tone="danger"
                action={
                  <Button size="sm" onClick={reload} icon={<RetryIcon className="h-4 w-4" />}>
                    নতুন করে আনুন
                  </Button>
                }
              >
                এর মধ্যে অন্য কেউ এই সূরার নোট বদলেছেন। নতুন করে আনলে আপনার অসংরক্ষিত পরিবর্তন মুছে
                যাবে।
              </Notice>
            </div>
          ) : null}

          {error && !current ? (
            <LoadError message={error} onRetry={reload} />
          ) : !current || (loading && !source) ? (
            <Skeleton rows={4} />
          ) : current.ayahs.length === 0 ? (
            <EmptyState title="এই সূরার কোনো আয়াত বা নোট পাওয়া যায়নি" />
          ) : filtered.length === 0 ? (
            <EmptyState title="কিছু পাওয়া যায়নি">
              অন্য শব্দ বা আয়াত নম্বর দিয়ে খুঁজুন।
            </EmptyState>
          ) : (
            <>
              <p className="mb-3 text-xs text-(--text-3)">
                {query
                  ? `${formatCount(filtered.length)}টি আয়াত মিলেছে`
                  : `${formatCount(current.ayahs.length)}টি আয়াত`}
              </p>
              <VirtualList
                key={current.surah.number}
                items={filtered}
                getKey={(ayah) => String(ayah.ayah)}
                estimateSize={380}
                gap={12}
                overscan={6}
                hasMore={false}
                endLabel={null}
                className={clsx(loading && "opacity-60")}
                renderItem={(ayah) => (
                  <AyahRow
                    ayah={ayah}
                    edit={edits[ayah.ayah]}
                    onEdit={onEdit}
                    onRevert={onRevert}
                  />
                )}
              />
            </>
          )}
        </div>
      </Card>

      <SaveBar
        dirty={dirty}
        message={
          tooLong
            ? "কিছু নোট দৈর্ঘ্যের সীমা ছাড়িয়েছে।"
            : dirty
              ? `${formatCount(changes.length)}টি আয়াতে অসংরক্ষিত পরিবর্তন আছে।`
              : undefined
        }
      >
        <Button
          onClick={() => setEdits({})}
          disabled={!dirty || saving}
          className="w-full sm:w-auto"
        >
          সব বাতিল
        </Button>
        <Button
          tone="primary"
          onClick={() => void save()}
          loading={saving}
          disabled={!dirty || tooLong || conflict}
          className="w-full sm:w-auto"
        >
          সূরা সংরক্ষণ করুন
        </Button>
      </SaveBar>

      <ConfirmDialog
        open={pendingSurah !== null}
        title="অসংরক্ষিত পরিবর্তন মুছে যাবে"
        message={`এই সূরায় ${formatCount(changes.length)}টি আয়াতের পরিবর্তন সংরক্ষণ করা হয়নি। অন্য সূরায় গেলে সেগুলো হারিয়ে যাবে।`}
        confirmLabel="তবুও যান"
        onClose={closeSwitch}
        onConfirm={() => {
          if (pendingSurah !== null) openSurah(pendingSurah);
        }}
      />
    </>
  );
}
