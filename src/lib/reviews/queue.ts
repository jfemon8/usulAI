import { createHash } from "node:crypto";
import { ObjectId, type Filter, type UpdateFilter } from "mongodb";
import { ADMIN_CONFIG, DB_CONFIG, REVIEW_CONFIG } from "@/config/site";
import { AdminError } from "@/lib/admin/errors";
import type { BaseRole } from "@/lib/admin/roles";
import { normalizeQuestion } from "@/lib/analytics/verifiedAnswers";
import { getDb } from "@/lib/db/mongoClient";
import { topicKey } from "@/lib/learning/topicKey";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource } from "@/types";

export type ReviewVerdict = "unhelpful" | "wrong-citation";
export type ReviewOrigin = "explicit" | "implicit";
export type ReviewStatusFilter = "all" | "unclaimed" | "claimed" | "mine";
export type ReviewVerdictFilter = "" | ReviewVerdict | "implicit";
export type ReviewSort = "flagged" | "newest";

export const REVIEW_MAX_NOTES = 10;
export const REVIEW_MAX_SOURCES = 40;
const REFERENCE_CHARS = 400;

export interface ReviewNote {
  text: string;
  verdict: ReviewVerdict;
  origin: ReviewOrigin;
  at: Date;
}

export interface ReviewClaim {
  by: string;
  name: string;
  category: string;
  email: string;
  at: Date;
  expiresAt: Date;
}

export interface ReviewItem {
  _id: ObjectId;
  key: string;
  status: "open";
  question: string;
  answer: string;
  sources: AnswerSource[];
  topic: string;
  count: number;
  unhelpful?: number;
  wrongCitation?: number;
  implicit?: number;
  notes?: ReviewNote[];
  claim?: ReviewClaim | null;
  createdAt: Date;
  lastFlaggedAt: Date;
}

export interface ReviewInput {
  verdict: ReviewVerdict;
  question: string;
  answer: string;
  sources: readonly AnswerSource[];
  note?: string;
  origin: ReviewOrigin;
}

export interface Reviewer {
  principalId: string;
  name: string;
  categoryName: string;
  email: string;
  role: BaseRole;
}

export interface ClaimView {
  name: string;
  category: string;
  at: string;
  expiresAt: string;
  mine: boolean;
}

export interface ReviewSummary {
  id: string;
  question: string;
  excerpt: string;
  count: number;
  unhelpful: number;
  wrongCitation: number;
  implicit: number;
  noteCount: number;
  sourceCount: number;
  createdAt: string;
  lastFlaggedAt: string;
  claim: ClaimView | null;
}

export interface ReviewDetail extends ReviewSummary {
  answer: string;
  topic: string;
  sources: AnswerSource[];
  notes: { text: string; verdict: ReviewVerdict; origin: ReviewOrigin; at: string }[];
}

export interface ReviewStats {
  open: number;
  claimed: number;
  mine: number;
  wrongCitation: number;
}

const VERDICT_FIELDS = {
  unhelpful: "unhelpful",
  "wrong-citation": "wrongCitation",
} as const satisfies Record<ReviewVerdict, keyof ReviewItem>;

export function reviewKey(question: string, answer: string): string {
  const basis = `${normalizeQuestion(question)}\n${answer.replace(/\s+/g, " ").trim()}`;
  return createHash("sha256").update(basis).digest("base64url").slice(0, 32);
}

export function compactReviewSources(sources: readonly AnswerSource[]): AnswerSource[] {
  return sources.slice(0, REVIEW_MAX_SOURCES).map((source, position) => ({
    index: Number.isFinite(source.index) ? source.index : position + 1,
    sourceType: source.sourceType,
    reference: source.reference.slice(0, REFERENCE_CHARS),
    ...(source.page !== undefined ? { page: source.page } : {}),
    ...(source.pageCount !== undefined ? { pageCount: source.pageCount } : {}),
    ...(source.grade ? { grade: source.grade } : {}),
    similarity: 0,
  }));
}

export function enqueueUpdate(input: ReviewInput, now: Date): UpdateFilter<ReviewItem> {
  const note = input.note?.trim().slice(0, REVIEW_CONFIG.maxNoteChars);
  const increments: Record<string, number> = { count: 1, [VERDICT_FIELDS[input.verdict]]: 1 };
  if (input.origin === "implicit") increments.implicit = 1;

  return {
    $inc: increments,
    $set: { lastFlaggedAt: now },
    $setOnInsert: {
      status: "open",
      question: input.question.trim().slice(0, REVIEW_CONFIG.maxQuestionChars),
      answer: input.answer.trim().slice(0, REVIEW_CONFIG.maxAnswerChars),
      sources: compactReviewSources(input.sources),
      topic: topicKey(input.question),
      createdAt: now,
    },
    ...(note
      ? {
          $push: {
            notes: {
              $each: [{ text: note, verdict: input.verdict, origin: input.origin, at: now }],
              $slice: -REVIEW_MAX_NOTES,
            },
          },
        }
      : {}),
  } as UpdateFilter<ReviewItem>;
}

async function reviewCollection() {
  return (await getDb()).collection<ReviewItem>(DB_CONFIG.reviewQueueCollection);
}

let reviewIndexes: Promise<void> | null = null;

function ensureReviewIndexes(): Promise<void> {
  reviewIndexes ??= reviewCollection()
    .then((items) =>
      items.createIndexes([
        { key: { key: 1 }, name: "review_key", unique: true },
        { key: { status: 1, lastFlaggedAt: -1, _id: -1 }, name: "review_status_recent" },
        {
          key: { status: 1, count: -1, lastFlaggedAt: -1, _id: -1 },
          name: "review_status_flagged",
        },
      ]),
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      reviewIndexes = null;
      logger.warn("Review queue index creation failed", { error: String(error).slice(0, 160) });
    });
  return reviewIndexes;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000
  );
}

export async function enqueueReview(input: ReviewInput): Promise<void> {
  try {
    if (!input.question.trim() || !input.answer.trim()) return;
    await ensureReviewIndexes();
    const items = await reviewCollection();
    const key = reviewKey(input.question, input.answer);
    const update = enqueueUpdate(input, new Date());

    const merged = await items.updateOne({ key }, update);
    if (merged.matchedCount > 0) return;

    const open = await items.countDocuments(
      { status: "open" },
      { limit: REVIEW_CONFIG.maxOpenItems },
    );
    if (open >= REVIEW_CONFIG.maxOpenItems) {
      logger.warn("Review queue is full, new item not added", {
        open,
        question: input.question.slice(0, 80),
      });
      return;
    }

    try {
      await items.updateOne({ key }, update, { upsert: true });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      await items.updateOne({ key }, update);
    }
  } catch (error) {
    logger.warn("Review queue write failed", { error: String(error).slice(0, 160) });
  }
}

export function statusFilter(
  status: ReviewStatusFilter,
  principalId: string,
  now: Date,
): Filter<ReviewItem> {
  switch (status) {
    case "unclaimed":
      return { status: "open", $or: [{ claim: null }, { "claim.expiresAt": { $lte: now } }] };
    case "claimed":
      return { status: "open", "claim.expiresAt": { $gt: now } };
    case "mine":
      return { status: "open", "claim.by": principalId, "claim.expiresAt": { $gt: now } };
    default:
      return { status: "open" };
  }
}

export function verdictFilter(verdict: ReviewVerdictFilter): Filter<ReviewItem> {
  if (verdict === "unhelpful") return { unhelpful: { $gt: 0 } };
  if (verdict === "wrong-citation") return { wrongCitation: { $gt: 0 } };
  if (verdict === "implicit") return { implicit: { $gt: 0 } };
  return {};
}

export interface ReviewCursor {
  count: number;
  at: Date;
  id: ObjectId;
}

export function encodeReviewCursor(
  sort: ReviewSort,
  row: { _id: ObjectId; count: number; lastFlaggedAt: Date },
): string {
  const tail = `${row.lastFlaggedAt.getTime()}.${row._id.toHexString()}`;
  return sort === "flagged" ? `${row.count}.${tail}` : tail;
}

export function parseReviewCursor(sort: ReviewSort, value: string): ReviewCursor {
  const pattern =
    sort === "flagged"
      ? /^(\d{1,9})\.(\d{1,16})\.([0-9a-f]{24})$/i
      : /^()(\d{1,16})\.([0-9a-f]{24})$/i;
  const match = pattern.exec(value.trim());
  if (!match?.[2] || !match[3]) throw new AdminError("পাতার কার্সর সঠিক নয়।");
  return {
    count: Number(match[1] || 0),
    at: new Date(Number(match[2])),
    id: new ObjectId(match[3]),
  };
}

export function reviewsAfter(sort: ReviewSort, cursor: ReviewCursor): Filter<ReviewItem> {
  if (sort === "flagged") {
    return {
      $or: [
        { count: { $lt: cursor.count } },
        { count: cursor.count, lastFlaggedAt: { $lt: cursor.at } },
        { count: cursor.count, lastFlaggedAt: cursor.at, _id: { $lt: cursor.id } },
      ],
    };
  }
  return {
    $or: [
      { lastFlaggedAt: { $lt: cursor.at } },
      { lastFlaggedAt: cursor.at, _id: { $lt: cursor.id } },
    ],
  };
}

export function activeClaim(claim: ReviewClaim | null | undefined, now: Date): ReviewClaim | null {
  return claim && claim.expiresAt.getTime() > now.getTime() ? claim : null;
}

function claimView(
  claim: ReviewClaim | null | undefined,
  principalId: string,
  now: Date,
): ClaimView | null {
  const active = activeClaim(claim, now);
  if (!active) return null;
  return {
    name: active.name,
    category: active.category,
    at: active.at.toISOString(),
    expiresAt: active.expiresAt.toISOString(),
    mine: active.by === principalId,
  };
}

function excerptOf(answer: string): string {
  const plain = answer
    .replace(/[#>*_`[\]()|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 200 ? `${plain.slice(0, 200).trimEnd()}…` : plain;
}

type SummaryRow = Pick<
  ReviewItem,
  | "_id"
  | "question"
  | "count"
  | "unhelpful"
  | "wrongCitation"
  | "implicit"
  | "claim"
  | "createdAt"
  | "lastFlaggedAt"
> & {
  answer: string;
  noteCount: number;
  sourceCount: number;
};

function toSummary(row: SummaryRow, principalId: string, now: Date): ReviewSummary {
  return {
    id: row._id.toHexString(),
    question: row.question,
    excerpt: excerptOf(row.answer),
    count: row.count ?? 0,
    unhelpful: row.unhelpful ?? 0,
    wrongCitation: row.wrongCitation ?? 0,
    implicit: row.implicit ?? 0,
    noteCount: row.noteCount ?? 0,
    sourceCount: row.sourceCount ?? 0,
    createdAt: row.createdAt.toISOString(),
    lastFlaggedAt: row.lastFlaggedAt.toISOString(),
    claim: claimView(row.claim, principalId, now),
  };
}

export function parseReviewId(id: string): ObjectId {
  const trimmed = id.trim();
  if (!/^[0-9a-f]{24}$/i.test(trimmed)) {
    throw new AdminError("রিভিউটি পাওয়া যায়নি।", 404);
  }
  return new ObjectId(trimmed);
}

export async function listReviews(
  options: {
    status: ReviewStatusFilter;
    verdict: ReviewVerdictFilter;
    sort: ReviewSort;
    cursor?: string;
  },
  reviewer: Pick<Reviewer, "principalId">,
): Promise<{ items: ReviewSummary[]; nextCursor: string | null; stats: ReviewStats | null }> {
  await ensureReviewIndexes();
  const now = new Date();
  const items = await reviewCollection();
  const filter: Filter<ReviewItem> = {
    $and: [
      statusFilter(options.status, reviewer.principalId, now),
      verdictFilter(options.verdict),
      ...(options.cursor
        ? [reviewsAfter(options.sort, parseReviewCursor(options.sort, options.cursor))]
        : []),
    ],
  };
  const pageSize = ADMIN_CONFIG.pageSize;

  const rowsPromise = items
    .find(filter, {
      projection: {
        question: 1,
        count: 1,
        unhelpful: 1,
        wrongCitation: 1,
        implicit: 1,
        claim: 1,
        createdAt: 1,
        lastFlaggedAt: 1,
        answer: { $substrCP: ["$answer", 0, 400] },
        noteCount: { $size: { $ifNull: ["$notes", []] } },
        sourceCount: { $size: { $ifNull: ["$sources", []] } },
      },
    })
    .sort(
      options.sort === "flagged"
        ? { count: -1, lastFlaggedAt: -1, _id: -1 }
        : { lastFlaggedAt: -1, _id: -1 },
    )
    .limit(pageSize + 1)
    .toArray() as unknown as Promise<SummaryRow[]>;

  const statsPromise = options.cursor
    ? Promise.resolve(null)
    : Promise.all([
        items.countDocuments(statusFilter("all", reviewer.principalId, now)),
        items.countDocuments(statusFilter("claimed", reviewer.principalId, now)),
        items.countDocuments(statusFilter("mine", reviewer.principalId, now)),
        items.countDocuments({ status: "open", wrongCitation: { $gt: 0 } }),
      ]).then(([open, claimed, mine, wrongCitation]) => ({ open, claimed, mine, wrongCitation }));

  const [rows, stats] = await Promise.all([rowsPromise, statsPromise]);
  const page = rows.slice(0, pageSize);
  const last = page.at(-1);

  return {
    items: page.map((row) => toSummary(row, reviewer.principalId, now)),
    nextCursor: rows.length > pageSize && last ? encodeReviewCursor(options.sort, last) : null,
    stats,
  };
}

export function toReviewDetail(
  row: ReviewItem,
  principalId: string,
  now = new Date(),
): ReviewDetail {
  const notes = [...(row.notes ?? [])].reverse();
  const sources = Array.isArray(row.sources) ? row.sources : [];
  return {
    ...toSummary(
      { ...row, noteCount: notes.length, sourceCount: sources.length },
      principalId,
      now,
    ),
    answer: row.answer,
    topic: row.topic ?? "",
    sources,
    notes: notes.map((note) => ({
      text: note.text,
      verdict: note.verdict,
      origin: note.origin,
      at: note.at.toISOString(),
    })),
  };
}

export async function getReview(id: string, reviewer: Pick<Reviewer, "principalId">) {
  const row = await (await reviewCollection()).findOne({ _id: parseReviewId(id) });
  if (!row) throw new AdminError("রিভিউটি পাওয়া যায়নি। হয়তো অন্য কেউ এটি সমাধান করেছেন।", 404);
  return toReviewDetail(row, reviewer.principalId);
}

export function claimableFilter(id: ObjectId, reviewer: Reviewer, now: Date): Filter<ReviewItem> {
  if (reviewer.role === "admin") return { _id: id };
  return {
    _id: id,
    $or: [
      { claim: null },
      { "claim.expiresAt": { $lte: now } },
      { "claim.by": reviewer.principalId },
    ],
  };
}

export function newClaim(reviewer: Reviewer, now: Date): ReviewClaim {
  return {
    by: reviewer.principalId,
    name: reviewer.name,
    category: reviewer.categoryName,
    email: reviewer.email,
    at: now,
    expiresAt: new Date(now.getTime() + REVIEW_CONFIG.claimMinutes * 60_000),
  };
}

export async function claimReview(
  id: string,
  reviewer: Reviewer,
): Promise<{ item: ReviewItem; takenFrom: ReviewClaim | null }> {
  const _id = parseReviewId(id);
  const now = new Date();
  const items = await reviewCollection();
  const before = await items.findOneAndUpdate(
    claimableFilter(_id, reviewer, now),
    { $set: { claim: newClaim(reviewer, now) } },
    { returnDocument: "before" },
  );

  if (!before) {
    const current = await items.findOne({ _id }, { projection: { claim: 1 } });
    if (!current) {
      throw new AdminError("রিভিউটি পাওয়া যায়নি। হয়তো অন্য কেউ এটি সমাধান করেছেন।", 404);
    }
    const holder = activeClaim(current.claim, now);
    throw new AdminError(
      holder
        ? `এটি এখন ${holder.category} ${holder.name} দেখছেন। তাঁর দাবির মেয়াদ শেষ হলে আপনি নিতে পারবেন।`
        : "রিভিউটি এখন নেওয়া গেল না। আবার চেষ্টা করুন।",
      409,
    );
  }

  const previous = activeClaim(before.claim, now);
  return {
    item: { ...before, claim: newClaim(reviewer, now) },
    takenFrom: previous && previous.by !== reviewer.principalId ? previous : null,
  };
}

export async function releaseReview(id: string, reviewer: Reviewer): Promise<void> {
  const _id = parseReviewId(id);
  const items = await reviewCollection();
  const result = await items.updateOne(
    reviewer.role === "admin" ? { _id } : { _id, "claim.by": reviewer.principalId },
    { $unset: { claim: "" } },
  );
  if (result.matchedCount === 1) return;
  if (await items.findOne({ _id }, { projection: { _id: 1 } })) {
    throw new AdminError("শুধু যিনি দাবি করেছেন তিনিই এটি ছেড়ে দিতে পারেন।", 403);
  }
  throw new AdminError("রিভিউটি পাওয়া যায়নি।", 404);
}

export async function removeReview(id: string): Promise<ReviewItem | null> {
  return (await reviewCollection()).findOneAndDelete({ _id: parseReviewId(id) });
}
