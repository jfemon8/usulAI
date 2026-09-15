"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AdminApiError, adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, Dialog, useToast } from "@/components/admin/Dialog";
import {
  AnswerWriter,
  MASALA_LIMITS,
  SourcesEditor,
  duplicateSourceKeys,
  missingSources,
  rowsFromSources,
  sourcePayload,
  useReferenceChecks,
  type SourceRow,
} from "@/components/admin/masail/MasalaFields";
import { ClaimBadge, FlagBadges } from "@/components/admin/reviews/ReviewBits";
import type { ResolutionResult, ReviewDetailData } from "@/components/admin/reviews/types";
import { CharCount, Toggle } from "@/components/admin/site/FormBits";
import {
  Badge,
  Button,
  Card,
  Field,
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
import { AnswerMarkdown } from "@/components/chat/AnswerMarkdown";
import { SourceCitationList } from "@/components/chat/SourceCitation";
import {
  CheckIcon,
  ChevronLeftIcon,
  CloseIcon,
  PenIcon,
  TrashIcon,
  UserIcon,
} from "@/components/ui/Icons";
import { RATE_LIMIT_CONFIG, REVIEW_CONFIG } from "@/config/site";
import type { PrincipalView } from "@/lib/admin/roles";

const REASON_CHARS = 1_000;

type Mode = "confirm" | "correct" | "dismiss" | null;

interface CorrectionForm {
  question: string;
  answer: string;
  sources: SourceRow[];
  published: boolean;
  reviewerNote: string;
}

function BackLink() {
  return (
    <Link
      href="/admin/reviews"
      className="mb-3 inline-flex items-center gap-1 text-sm text-(--text-2) hover:text-(--text-1)"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      সব রিভিউ
    </Link>
  );
}

const ORIGIN_LABELS = { explicit: "বোতামে", implicit: "কথোপকথনে" } as const;
const VERDICT_LABELS = { unhelpful: "সহায়ক নয়", "wrong-citation": "সূত্র ভুল" } as const;

export function ReviewDetail({ id, principal }: { id: string; principal: PrincipalView }) {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload, replace } = useAdminData<ReviewDetailData>(
    `/api/admin/reviews/${id}`,
  );
  const canHandle = principal.permissions.includes("reviews.handle");
  const isAdmin = principal.role === "admin";
  const [claiming, setClaiming] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [saveAsMasala, setSaveAsMasala] = useState(true);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState<CorrectionForm | null>(null);
  const references = useReferenceChecks();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closeDialog = useCallback(() => {
    setMode(null);
    setDialogError(null);
  }, []);
  const closeDelete = useCallback(() => setDeleteOpen(false), []);

  if (error && !data) {
    return (
      <>
        <BackLink />
        <PageHeader title="উত্তর রিভিউ" />
        <LoadError message={error} onRetry={reload} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <BackLink />
        <PageHeader title="উত্তর রিভিউ" />
        <Skeleton rows={6} />
      </>
    );
  }

  const review = data;
  const heldByOther = review.claim !== null && !review.claim.mine;
  const canResolve = canHandle && (!heldByOther || isAdmin);

  async function changeClaim(action: "claim" | "release") {
    setClaiming(true);
    try {
      const next = await adminApi<ReviewDetailData>(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        body: { action },
      });
      replace(next);
      toast.success(
        action === "claim" ? "রিভিউটির দায়িত্ব নিয়েছেন।" : "দায়িত্ব ছেড়ে দিয়েছেন।",
      );
    } catch (failure) {
      toast.error(errorMessage(failure));
      if (failure instanceof AdminApiError && (failure.status === 409 || failure.status === 404)) {
        reload();
      }
    } finally {
      setClaiming(false);
    }
  }

  function openCorrection() {
    setCorrection({
      question: review.question.slice(0, RATE_LIMIT_CONFIG.maxQuestionChars),
      answer: review.answer,
      sources: rowsFromSources(review.sources),
      published: false,
      reviewerNote: "",
    });
    references.setChecks(new Map());
    setDialogError(null);
    setMode("correct");
  }

  async function resolve(body: Record<string, unknown>) {
    setSubmitting(true);
    setDialogError(null);
    try {
      const result = await adminApi<ResolutionResult>(`/api/admin/reviews/${id}/resolve`, {
        method: "POST",
        body,
      });
      toast.success(
        result.action === "dismiss"
          ? "রিভিউটি বাতিল করে তালিকা থেকে সরানো হয়েছে।"
          : result.masalaId
            ? result.published
              ? "সমাধান হয়েছে, মাসআলাটি সংরক্ষিত ও প্রকাশিত।"
              : "সমাধান হয়েছে, মাসআলাটি সংরক্ষিত।"
            : "উত্তরটি সঠিক হিসেবে চিহ্নিত হয়েছে।",
      );
      setMode(null);
      router.push("/admin/reviews");
    } catch (failure) {
      setDialogError(errorMessage(failure));
      if (failure instanceof AdminApiError && failure.status === 422 && correction) {
        void references.check(sourcePayload(correction.sources));
      }
      setSubmitting(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await adminApi(`/api/admin/reviews/${id}`, { method: "DELETE" });
      toast.success("রিভিউটি মুছে ফেলা হয়েছে।");
      router.push("/admin/reviews");
    } catch (failure) {
      toast.error(errorMessage(failure));
      setDeleting(false);
    }
  }

  const correctionBody = correction
    ? {
        action: "correct" as const,
        question: correction.question.trim(),
        answer: correction.answer.trim(),
        sources: sourcePayload(correction.sources),
        published: correction.published,
        reviewerNote: correction.reviewerNote.trim(),
      }
    : null;
  const correctionMissing = correction ? missingSources(correction.sources, references.checks) : [];
  const correctionValid =
    correctionBody !== null &&
    correction !== null &&
    correctionBody.question.length > 0 &&
    correctionBody.question.length <= RATE_LIMIT_CONFIG.maxQuestionChars &&
    correctionBody.answer.length > 0 &&
    correctionBody.answer.length <= MASALA_LIMITS.answerChars &&
    correctionBody.reviewerNote.length <= MASALA_LIMITS.noteChars &&
    duplicateSourceKeys(correction.sources).size === 0 &&
    correctionMissing.length === 0;

  return (
    <>
      <BackLink />
      <PageHeader
        title="উত্তর রিভিউ"
        description="পাঠকের অভিযোগ দেখে সিদ্ধান্ত নিন। সমাধান করলে এটি তালিকা থেকে সরে যাবে।"
        actions={
          isAdmin ? (
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

      <div className="-mt-2 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-(--text-3)">
        <Badge tone="danger">মোট {formatCount(review.count)} বার অভিযোগ</Badge>
        <FlagBadges row={review} />
        <span>প্রথম অভিযোগ {formatWhen(review.createdAt)}</span>
        <span>সর্বশেষ {formatWhen(review.lastFlaggedAt)}</span>
      </div>

      <div className="flex flex-col gap-5">
        <Card
          title="দায়িত্ব"
          description={`একজন দায়িত্ব নিলে ${formatCount(REVIEW_CONFIG.claimMinutes)} মিনিট অন্য কেউ সমাধান করতে পারবেন না। মেয়াদ শেষ হলে যে কেউ নিতে পারবেন।`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-(--text-2)">
              <UserIcon className="h-4 w-4 shrink-0 text-(--text-3)" />
              <ClaimBadge claim={review.claim} />
              {review.claim ? (
                <span className="text-xs text-(--text-3)">
                  মেয়াদ {formatWhen(review.claim.expiresAt)} পর্যন্ত
                </span>
              ) : null}
            </div>
            {canHandle ? (
              <div className="flex flex-wrap gap-2">
                {review.claim?.mine || (review.claim && isAdmin) ? (
                  <Button
                    size="sm"
                    onClick={() => void changeClaim("release")}
                    loading={claiming}
                    className="w-full sm:w-auto"
                  >
                    দায়িত্ব ছেড়ে দিন
                  </Button>
                ) : null}
                {!review.claim?.mine && (!heldByOther || isAdmin) ? (
                  <Button
                    size="sm"
                    tone="primary"
                    onClick={() => void changeClaim("claim")}
                    loading={claiming}
                    className="w-full sm:w-auto"
                  >
                    {heldByOther ? "দায়িত্ব নিজের কাছে নিন" : "আমি দেখছি"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {!canHandle ? (
            <p className="mt-3 text-xs text-(--text-3)">
              আপনি শুধু দেখতে পারবেন। সমাধান করবেন আলেমগণ।
            </p>
          ) : heldByOther && !isAdmin ? (
            <p className="mt-3 text-xs text-(--warn)">
              {review.claim?.category} {review.claim?.name} এটি দেখছেন, তাই এখন সমাধান করা যাবে না।
            </p>
          ) : null}
        </Card>

        <Card title="প্রশ্ন">
          <p className="text-base break-words text-(--text-1)" dir="auto">
            {review.question}
          </p>
        </Card>

        <Card title="AI এর উত্তর" description="পাঠক যে উত্তরটি দেখেছিলেন, হুবহু।">
          <AnswerMarkdown text={review.answer} />
          <SourceCitationList sources={review.sources} />
        </Card>

        <Card
          title="পাঠকের মন্তব্য"
          description={
            review.notes.length > 0
              ? `সর্বশেষ ${formatCount(review.notes.length)}টি মন্তব্য`
              : undefined
          }
        >
          {review.notes.length === 0 ? (
            <p className="text-sm text-(--text-3)">কেউ মন্তব্য লেখেননি।</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {review.notes.map((note, index) => (
                <li key={`${note.at}-${index}`} className="rounded-xl bg-(--surface-2) px-4 py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-(--text-3)">
                    <Badge tone={note.verdict === "wrong-citation" ? "danger" : "warn"}>
                      {VERDICT_LABELS[note.verdict]}
                    </Badge>
                    <span>{ORIGIN_LABELS[note.origin]}</span>
                    <span>{formatWhen(note.at)}</span>
                  </div>
                  <p className="text-sm break-words whitespace-pre-wrap text-(--text-1)" dir="auto">
                    {note.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {canHandle ? (
          <Card
            title="সমাধান"
            description="উত্তর সঠিক হলে নিশ্চিত করুন, ভুল হলে সংশোধন করে মাসআলা হিসেবে সংরক্ষণ করুন, আর আসল সমস্যা না হলে বাতিল করুন।"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                tone="primary"
                icon={<CheckIcon className="h-4 w-4" />}
                disabled={!canResolve}
                onClick={() => {
                  setSaveAsMasala(true);
                  setPublishConfirmed(false);
                  setDialogError(null);
                  setMode("confirm");
                }}
              >
                উত্তর সঠিক
              </Button>
              <Button
                icon={<PenIcon className="h-4 w-4" />}
                disabled={!canResolve}
                onClick={openCorrection}
              >
                সংশোধন করুন
              </Button>
              <Button
                tone="ghost"
                icon={<CloseIcon className="h-4 w-4" />}
                disabled={!canResolve}
                onClick={() => {
                  setReason("");
                  setDialogError(null);
                  setMode("dismiss");
                }}
                className="border border-(--border)"
              >
                বাতিল
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      <Dialog
        open={mode === "confirm"}
        onClose={closeDialog}
        busy={submitting}
        title="উত্তরটি সঠিক?"
        description="নিশ্চিত করলে এই উত্তরের সূত্রগুলো এই বিষয়ে ওপরে আসবে এবং রিভিউটি তালিকা থেকে সরে যাবে।"
        footer={
          <>
            <Button onClick={closeDialog} disabled={submitting} className="w-full sm:w-auto">
              ফিরে যান
            </Button>
            <Button
              tone="primary"
              loading={submitting}
              className="w-full sm:w-auto"
              onClick={() =>
                void resolve({
                  action: "confirm",
                  saveAsMasala,
                  published: saveAsMasala && publishConfirmed,
                })
              }
            >
              নিশ্চিত করুন
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {dialogError ? <Notice tone="danger">{dialogError}</Notice> : null}
          <Toggle
            checked={saveAsMasala}
            onChange={setSaveAsMasala}
            label="মাসআলা হিসেবে সংরক্ষণ করুন"
            description="একই প্রশ্ন আবার এলে এই উত্তর আপনার নামসহ মডেল ছাড়াই দেখানো হবে।"
          />
          <Toggle
            checked={saveAsMasala && publishConfirmed}
            onChange={setPublishConfirmed}
            disabled={!saveAsMasala}
            label="পাবলিক মাসআলা পাতায় প্রকাশ করুন"
          />
        </div>
      </Dialog>

      <Dialog
        open={mode === "dismiss"}
        onClose={closeDialog}
        busy={submitting}
        title="রিভিউটি বাতিল করবেন?"
        description="অভিযোগটি আসল সমস্যা না হলে বা স্প্যাম হলে কারণ লিখে বাতিল করুন।"
        footer={
          <>
            <Button onClick={closeDialog} disabled={submitting} className="w-full sm:w-auto">
              ফিরে যান
            </Button>
            <Button
              tone="danger"
              loading={submitting}
              disabled={!reason.trim() || reason.trim().length > REASON_CHARS}
              className="w-full sm:w-auto"
              onClick={() => void resolve({ action: "dismiss", reason: reason.trim() })}
            >
              বাতিল করুন
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {dialogError ? <Notice tone="danger">{dialogError}</Notice> : null}
          <Field label="কারণ" hint={<CharCount value={reason} max={REASON_CHARS} />}>
            {(fieldId) => (
              <Textarea
                id={fieldId}
                dir="auto"
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="যেমন: উত্তর ঠিক আছে, পাঠক প্রশ্ন ভুল বুঝেছেন।"
              />
            )}
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={mode === "correct" && correction !== null}
        onClose={closeDialog}
        busy={submitting}
        size="xl"
        title="উত্তর সংশোধন"
        description="সংশোধিত উত্তর আপনার নামে মাসআলা হিসেবে সংরক্ষিত হবে এবং এই প্রশ্নে চ্যাটে দেখানো হবে।"
        footer={
          <>
            <Button onClick={closeDialog} disabled={submitting} className="w-full sm:w-auto">
              ফিরে যান
            </Button>
            <Button
              tone="primary"
              loading={submitting}
              disabled={!correctionValid}
              className="w-full sm:w-auto"
              onClick={() => correctionBody && void resolve(correctionBody)}
            >
              সংশোধন সংরক্ষণ করুন
            </Button>
          </>
        }
      >
        {correction ? (
          <div className="flex flex-col gap-5">
            {dialogError ? <Notice tone="danger">{dialogError}</Notice> : null}
            <Field
              label="প্রশ্ন"
              hint={
                <CharCount value={correction.question} max={RATE_LIMIT_CONFIG.maxQuestionChars} />
              }
            >
              {(fieldId) => (
                <Input
                  id={fieldId}
                  dir="auto"
                  value={correction.question}
                  onChange={(event) =>
                    setCorrection((previous) =>
                      previous ? { ...previous, question: event.target.value } : previous,
                    )
                  }
                />
              )}
            </Field>
            <AnswerWriter
              value={correction.answer}
              rows={12}
              inDialog
              title="সংশোধিত উত্তর"
              onChange={(answer) =>
                setCorrection((previous) => (previous ? { ...previous, answer } : previous))
              }
              sources={correction.sources}
            />
            <SourcesEditor
              rows={correction.sources}
              onChange={(sources) =>
                setCorrection((previous) => (previous ? { ...previous, sources } : previous))
              }
              checks={references.checks}
              checking={references.checking}
              onCheck={() => void references.check(sourcePayload(correction.sources))}
            />
            <Toggle
              checked={correction.published}
              onChange={(published) =>
                setCorrection((previous) => (previous ? { ...previous, published } : previous))
              }
              label="পাবলিক মাসআলা পাতায় প্রকাশ করুন"
            />
            <Field
              label="অভ্যন্তরীণ নোট (ঐচ্ছিক)"
              hint={<CharCount value={correction.reviewerNote} max={MASALA_LIMITS.noteChars} />}
            >
              {(fieldId) => (
                <Input
                  id={fieldId}
                  dir="auto"
                  value={correction.reviewerNote}
                  onChange={(event) =>
                    setCorrection((previous) =>
                      previous ? { ...previous, reviewerNote: event.target.value } : previous,
                    )
                  }
                />
              )}
            </Field>
            {correctionMissing.length > 0 ? (
              <Notice tone="danger">
                {formatCount(correctionMissing.length)}টি রেফারেন্স দলিল ভান্ডারে পাওয়া যায়নি।
              </Notice>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      {isAdmin ? (
        <ConfirmDialog
          open={deleteOpen}
          title="রিভিউটি মুছে ফেলবেন?"
          message="কোনো সিদ্ধান্ত ছাড়াই রিভিউটি তালিকা থেকে মুছে যাবে। এটি ফেরত আনা যাবে না।"
          confirmLabel="মুছে ফেলুন"
          busy={deleting}
          onClose={closeDelete}
          onConfirm={() => void remove()}
        />
      ) : null}
    </>
  );
}
