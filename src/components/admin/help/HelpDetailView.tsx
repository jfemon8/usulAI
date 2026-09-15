"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, Dialog, useToast } from "@/components/admin/Dialog";
import { HelpAnswerEditor } from "@/components/admin/help/HelpAnswerEditor";
import { HelpStatusCell } from "@/components/admin/help/HelpList";
import {
  Button,
  Card,
  Field,
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
import { AnswerMarkdown } from "@/components/chat/AnswerMarkdown";
import { RichContent } from "@/components/editor/RichContent";
import { SourceCitationList } from "@/components/chat/SourceCitation";
import {
  BadgeCheckIcon,
  ChevronLeftIcon,
  CloseIcon,
  ExternalLinkIcon,
  PenIcon,
  RetryIcon,
  TrashIcon,
  UserIcon,
} from "@/components/ui/Icons";
import {
  HELP_CLOSE_REASONS,
  HELP_CLOSE_REASON_LABELS,
  type HelpActionResponse,
  type HelpAssignee,
  type HelpCloseReason,
  type HelpDetail,
} from "@/lib/help/types";

const NOTE_CHARS = 1_000;

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-xs text-(--text-3) sm:w-32 sm:text-sm">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-(--text-1)">{children}</dd>
    </div>
  );
}

function notificationText(detail: HelpDetail): string {
  if (!detail.email) return "ইমেইল দেওয়া হয়নি";
  if (!detail.notification)
    return detail.status === "answered" ? "পাঠানো হয়নি" : "উত্তর দিলে পাঠানো হবে";
  const when = formatWhen(detail.notification.at);
  if (detail.notification.sent) return `ইমেইল পাঠানো হয়েছে, ${when}`;
  return detail.notification.error
    ? `ইমেইল যায়নি (${detail.notification.error}), ${when}`
    : `ইমেইল যায়নি, ${when}`;
}

export function HelpDetailView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload, replace } = useAdminData<HelpDetail>(
    `/api/admin/help/${id}`,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState<HelpCloseReason>("duplicate");
  const [closeNote, setCloseNote] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const assignees = useAdminData<{ items: HelpAssignee[] }>(
    data?.can.reassign ? "/api/admin/help/assignees" : null,
  );
  const closeCloseDialog = useCallback(() => setCloseOpen(false), []);
  const closeReopen = useCallback(() => setReopenOpen(false), []);
  const closeDelete = useCallback(() => setDeleteOpen(false), []);

  async function act(name: string, body: Record<string, unknown>, success: string) {
    setBusy(name);
    try {
      const response = await adminApi<HelpActionResponse>(`/api/admin/help/${id}`, {
        method: "PATCH",
        body,
      });
      replace(response.detail);
      if (response.warning) toast.error(response.warning);
      else toast.success(success);
      return true;
    } catch (failure) {
      toast.error(errorMessage(failure));
      reload();
      return false;
    } finally {
      setBusy(null);
    }
  }

  function saved(response: HelpActionResponse) {
    const wasEditing = data?.status === "answered";
    replace(response.detail);
    setEditingAnswer(false);
    if (response.warning) toast.error(response.warning);
    else toast.success(wasEditing ? "উত্তর হালনাগাদ হয়েছে।" : "উত্তর পাঠানো হয়েছে।");
  }

  async function remove() {
    setBusy("delete");
    try {
      await adminApi(`/api/admin/help/${id}`, { method: "DELETE" });
      toast.success("প্রশ্নটি মুছে ফেলা হয়েছে।");
      router.push("/admin/help");
    } catch (failure) {
      toast.error(errorMessage(failure));
      setBusy(null);
    }
  }

  if (error && !data) {
    return (
      <>
        <BackLink />
        <PageHeader title="প্রশ্নের বিস্তারিত" />
        <LoadError message={error} onRetry={reload} />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <BackLink />
        <PageHeader title="প্রশ্নের বিস্তারিত" />
        <Skeleton rows={6} />
      </>
    );
  }

  const detail = data;
  const { can } = detail;
  const showEditor =
    can.answer && (detail.status === "open" || (detail.status === "answered" && editingAnswer));

  return (
    <>
      <BackLink />
      <PageHeader
        title="প্রশ্নের বিস্তারিত"
        actions={
          <>
            <Button
              tone="ghost"
              icon={<RetryIcon className="h-4 w-4" />}
              onClick={reload}
              disabled={loading}
            >
              হালনাগাদ
            </Button>
            {can.reopen ? (
              <Button onClick={() => setReopenOpen(true)} disabled={busy !== null}>
                আবার খুলুন
              </Button>
            ) : null}
            {can.delete ? (
              <Button
                tone="ghost"
                icon={<TrashIcon className="h-4 w-4" />}
                onClick={() => setDeleteOpen(true)}
                disabled={busy !== null}
                className="hover:text-(--danger)"
              >
                মুছুন
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <HelpStatusCell row={detail} />
              {detail.hasContext ? (
                <span className="text-xs text-(--text-3)">AI উত্তরসহ পাঠানো</span>
              ) : null}
            </div>
            <p dir="auto" className="text-base leading-7 break-words whitespace-pre-wrap">
              {detail.question}
            </p>
            {detail.details ? (
              <div className="rounded-xl bg-(--surface-2) px-4 py-3">
                <p className="mb-1 text-xs font-medium text-(--text-3)">বিস্তারিত</p>
                <p
                  dir="auto"
                  className="text-sm leading-6 break-words whitespace-pre-wrap text-(--text-1)"
                >
                  {detail.details}
                </p>
              </div>
            ) : null}
            <dl className="flex flex-col gap-2 border-t border-(--border) pt-4">
              <MetaRow label="পাঠানো">{formatWhen(detail.createdAt)}</MetaRow>
              <MetaRow label="প্রশ্নকারী">
                {detail.requesterName ?? "নাম দেওয়া হয়নি"}
                {detail.email ? (
                  <span className="ms-2 break-all text-(--text-3)">{detail.email}</span>
                ) : null}
              </MetaRow>
              <MetaRow label="জানানো">{notificationText(detail)}</MetaRow>
              {detail.updatedAt ? (
                <MetaRow label="সর্বশেষ পরিবর্তন">{formatWhen(detail.updatedAt)}</MetaRow>
              ) : null}
              {detail.expiresAt ? (
                <MetaRow label="মুছে যাবে">{formatWhen(detail.expiresAt)}</MetaRow>
              ) : null}
            </dl>
          </div>
        </Card>

        {detail.status === "open" ? (
          <Card title="কে দেখছেন">
            <div className="flex flex-col gap-4">
              {detail.claim ? (
                <p className="flex items-start gap-2 text-sm leading-6">
                  <UserIcon className="mt-1 h-4 w-4 shrink-0 text-(--text-3)" />
                  <span>
                    {detail.claim.mine
                      ? "আপনি প্রশ্নটি দেখছেন।"
                      : `${detail.claim.category} ${detail.claim.name} প্রশ্নটি দেখছেন।`}{" "}
                    <span className="text-(--text-3)">
                      {formatWhen(detail.claim.expiresAt)} পর্যন্ত সংরক্ষিত।
                    </span>
                  </span>
                </p>
              ) : (
                <p className="text-sm text-(--text-2)">
                  এখনো কেউ প্রশ্নটি নেননি।
                  {can.claim ? " উত্তর লেখার আগে নিজের নামে নিন, যাতে দুজন একই কাজ না করেন।" : ""}
                </p>
              )}
              {!detail.viewer.canHandle ? (
                <Notice>আপনি শুধু দেখতে পারবেন। উত্তর দেওয়ার কাজ আলেম ও অ্যাডমিনগণ করেন।</Notice>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {can.claim ? (
                  <Button
                    tone={detail.claim?.mine ? "secondary" : "primary"}
                    loading={busy === "claim"}
                    disabled={busy !== null}
                    onClick={() =>
                      void act(
                        "claim",
                        { action: "claim" },
                        detail.claim?.mine
                          ? "সময় বাড়ানো হয়েছে।"
                          : "প্রশ্নটি আপনার নামে নেওয়া হয়েছে।",
                      )
                    }
                  >
                    {detail.claim?.mine
                      ? "সময় বাড়ান"
                      : detail.claim
                        ? "নিজের নামে নিন (অ্যাডমিন)"
                        : "নিজের নামে নিন"}
                  </Button>
                ) : null}
                {can.release ? (
                  <Button
                    loading={busy === "release"}
                    disabled={busy !== null}
                    onClick={() =>
                      void act("release", { action: "release" }, "প্রশ্নটি ছেড়ে দেওয়া হয়েছে।")
                    }
                  >
                    ছেড়ে দিন
                  </Button>
                ) : null}
                {can.close ? (
                  <Button
                    tone="ghost"
                    icon={<CloseIcon className="h-4 w-4" />}
                    disabled={busy !== null}
                    onClick={() => setCloseOpen(true)}
                  >
                    বন্ধ করুন
                  </Button>
                ) : null}
              </div>
              {can.reassign ? (
                <div className="flex flex-col gap-2 border-t border-(--border) pt-4 sm:flex-row sm:items-end">
                  <Field
                    label="অন্য কাউকে দিন"
                    className="min-w-0 flex-1"
                    error={assignees.error}
                    hint="দেওয়া ব্যক্তির নামে প্রশ্নটি সংরক্ষিত হবে।"
                  >
                    {(fieldId) => (
                      <Select
                        id={fieldId}
                        value={assignee}
                        onChange={(event) => setAssignee(event.target.value)}
                        disabled={assignees.loading}
                      >
                        <option value="">
                          {assignees.loading ? "তালিকা আসছে…" : "একজন বেছে নিন"}
                        </option>
                        {(assignees.data?.items ?? []).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.category} {item.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Button
                    loading={busy === "reassign"}
                    disabled={!assignee || busy !== null}
                    onClick={() =>
                      void act(
                        "reassign",
                        { action: "reassign", assigneeId: assignee },
                        "প্রশ্নটি দেওয়া হয়েছে।",
                      ).then((ok) => {
                        if (ok) setAssignee("");
                      })
                    }
                    className="sm:mb-6"
                  >
                    দিন
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {detail.context.aiAnswer || detail.context.references.length > 0 ? (
          <Card
            title="AI-এর দেওয়া উত্তর"
            description="প্রশ্নকারী এই উত্তর দেখে আলেমের কাছে পাঠিয়েছেন। ভুল থাকলে উত্তরে তা স্পষ্ট করুন।"
          >
            {detail.context.aiAnswer ? (
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-(--accent) select-none">
                  উত্তরটি দেখুন
                </summary>
                <div className="mt-3 min-w-0 rounded-xl border border-(--border) p-4">
                  <AnswerMarkdown text={detail.context.aiAnswer} />
                </div>
              </details>
            ) : null}
            {detail.context.sources.length > 0 ? (
              <SourceCitationList sources={detail.context.sources} />
            ) : null}
            {detail.context.references.length > detail.context.resolved.length ? (
              <div className="mt-4">
                <p className="mb-1 text-xs text-(--text-3)">
                  দলিল ভান্ডারে পাওয়া যায়নি এমন রেফারেন্স (
                  {formatCount(detail.context.references.length - detail.context.resolved.length)}
                  টি)
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {detail.context.references
                    .filter(
                      (reference) =>
                        !detail.context.resolved.some((item) => item.reference === reference),
                    )
                    .map((reference) => (
                      <li
                        key={reference}
                        className="max-w-full rounded-full bg-(--surface-2) px-2.5 py-1 text-xs break-words text-(--text-2)"
                      >
                        {reference}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : null}

        {detail.status === "closed" ? (
          <Card title="প্রশ্নটি বন্ধ">
            <dl className="flex flex-col gap-2">
              <MetaRow label="কারণ">
                {detail.closedReason ? HELP_CLOSE_REASON_LABELS[detail.closedReason] : "নেই"}
              </MetaRow>
              {detail.closedNote ? (
                <MetaRow label="বার্তা">
                  <span className="whitespace-pre-wrap">{detail.closedNote}</span>
                </MetaRow>
              ) : null}
              {detail.closedBy ? <MetaRow label="বন্ধ করেছেন">{detail.closedBy}</MetaRow> : null}
              <MetaRow label="সময়">{formatWhen(detail.closedAt)}</MetaRow>
            </dl>
          </Card>
        ) : null}

        {detail.status === "answered" && detail.answer && !editingAnswer ? (
          <Card
            title="দেওয়া উত্তর"
            actions={
              <>
                {detail.masalaPath ? (
                  <Link
                    href={detail.masalaPath}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-(--border) px-3 text-sm text-(--text-1) hover:bg-(--surface-2)"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                    মাসআলা
                  </Link>
                ) : null}
                {can.answer ? (
                  <Button
                    size="sm"
                    icon={<PenIcon className="h-4 w-4" />}
                    onClick={() => setEditingAnswer(true)}
                  >
                    সম্পাদনা
                  </Button>
                ) : null}
                {can.close ? (
                  <Button size="sm" tone="ghost" onClick={() => setCloseOpen(true)}>
                    বন্ধ করুন
                  </Button>
                ) : null}
              </>
            }
          >
            {detail.answeredBy ? (
              <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-(--text-2)">
                <BadgeCheckIcon className="h-4 w-4 text-(--accent)" />
                {detail.answeredBy.category} {detail.answeredBy.name},{" "}
                {formatWhen(detail.answeredAt)}
              </p>
            ) : null}
            <div className="min-w-0">
              <RichContent text={detail.answer} />
            </div>
            {detail.sources.length > 0 ? <SourceCitationList sources={detail.sources} /> : null}
          </Card>
        ) : null}

        {showEditor ? (
          <HelpAnswerEditor
            key={`${detail.id}:${detail.status}`}
            detail={detail}
            onSaved={saved}
            onCancel={detail.status === "answered" ? () => setEditingAnswer(false) : undefined}
          />
        ) : null}
      </div>

      <Dialog
        open={closeOpen}
        onClose={closeCloseDialog}
        title="প্রশ্নটি বন্ধ করবেন?"
        description="প্রশ্নকারী ট্র্যাকিং লিংকে কারণ ও বার্তাটি দেখবেন।"
        busy={busy === "close"}
        footer={
          <>
            <Button
              onClick={closeCloseDialog}
              disabled={busy === "close"}
              className="w-full sm:w-auto"
            >
              বাতিল
            </Button>
            <Button
              tone="danger"
              loading={busy === "close"}
              disabled={closeNote.trim().length > NOTE_CHARS}
              className="w-full sm:w-auto"
              onClick={() =>
                void act(
                  "close",
                  { action: "close", reason: closeReason, note: closeNote.trim() },
                  "প্রশ্নটি বন্ধ করা হয়েছে।",
                ).then((ok) => {
                  if (!ok) return;
                  setCloseOpen(false);
                  setCloseNote("");
                })
              }
            >
              বন্ধ করুন
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="কারণ">
            {(fieldId) => (
              <Select
                id={fieldId}
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value as HelpCloseReason)}
              >
                {HELP_CLOSE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {HELP_CLOSE_REASON_LABELS[reason]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="প্রশ্নকারীর জন্য বার্তা (ঐচ্ছিক)"
            hint={`যেমন কোন মাসআলায় উত্তর আছে বা কার সাথে যোগাযোগ করবেন। সর্বোচ্চ ${formatCount(NOTE_CHARS)} অক্ষর।`}
            error={closeNote.trim().length > NOTE_CHARS ? "বার্তাটি অনেক বড়।" : null}
          >
            {(fieldId) => (
              <Textarea
                id={fieldId}
                dir="auto"
                rows={4}
                value={closeNote}
                onChange={(event) => setCloseNote(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={reopenOpen}
        title="প্রশ্নটি আবার খুলবেন?"
        message="প্রশ্নটি অপেক্ষমাণ তালিকায় ফিরে যাবে। আগের উত্তর থাকলে তা খসড়া হিসেবে থাকবে; আবার উত্তর দেওয়া না হওয়া পর্যন্ত প্রশ্নকারী তা দেখবেন না।"
        confirmLabel="আবার খুলুন"
        tone="primary"
        busy={busy === "reopen"}
        onClose={closeReopen}
        onConfirm={() =>
          void act("reopen", { action: "reopen" }, "প্রশ্নটি আবার খোলা হয়েছে।").then(() =>
            setReopenOpen(false),
          )
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        title="প্রশ্নটি মুছে ফেলবেন?"
        message="মুছে ফেললে প্রশ্নকারীর ট্র্যাকিং লিংক আর কাজ করবে না। প্রকাশিত মাসআলা থাকলে তা থেকে যাবে। এটি ফেরত আনা যাবে না।"
        confirmLabel="মুছে ফেলুন"
        busy={busy === "delete"}
        onClose={closeDelete}
        onConfirm={() => void remove()}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/help"
      className="mb-3 inline-flex items-center gap-1 text-sm text-(--text-2) hover:text-(--text-1)"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      সব প্রশ্ন
    </Link>
  );
}
