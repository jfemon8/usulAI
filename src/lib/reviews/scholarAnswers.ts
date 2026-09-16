import { z } from "zod";
import { MASAIL_CONFIG, RATE_LIMIT_CONFIG } from "@/config/site";
import { AdminError } from "@/lib/admin/errors";
import { markdownExcerpt } from "@/lib/editor/plainText";
import { ANSWER_LIMITS, answerSourceInput, validatedSources } from "@/lib/admin/answers";
import {
  deleteVerifiedAnswerById,
  findAnswersForQuestion,
  getVerifiedAnswerById,
  isScholarAnswer,
  listScholarAnswers,
  masalaPath,
  normalizeQuestion,
  parseScholarCursor,
  removeAutoVerifiedForQuestion,
  saveScholarAnswer,
  setScholarAnswerPublished,
  type MasalaAuthor,
  type StoredVerifiedAnswer,
} from "@/lib/analytics/verifiedAnswers";
import type { Reviewer } from "@/lib/reviews/queue";
import type { AnswerSource } from "@/types";

export const masalaInput = z.object({
  question: z.string().trim().min(1).max(RATE_LIMIT_CONFIG.maxQuestionChars),
  answer: z.string().trim().min(1).max(ANSWER_LIMITS.answerChars),
  sources: z.array(answerSourceInput).max(ANSWER_LIMITS.maxSources),
  category: z.string().trim().max(MASAIL_CONFIG.slugChars * 2).default(""),
  published: z.boolean(),
  reviewerNote: z.string().trim().max(ANSWER_LIMITS.reviewerNoteChars).default(""),
});

export type MasalaInput = z.infer<typeof masalaInput>;

export type WorkspaceTab = "mine" | "all" | "published";

export interface WorkspaceMasala {
  id: string;
  question: string;
  excerpt: string;
  category: string | null;
  author: MasalaAuthor | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  sourceCount: number;
  servedCount: number;
  canEdit: boolean;
  path: string | null;
}

export interface WorkspaceMasalaDetail extends WorkspaceMasala {
  answer: string;
  sources: AnswerSource[];
  reviewerNote: string;
}

export function isAdminReviewer(reviewer: Pick<Reviewer, "role">): boolean {
  return reviewer.role === "admin";
}

export function authorOf(reviewer: Reviewer): MasalaAuthor {
  return { id: reviewer.principalId, name: reviewer.name, category: reviewer.categoryName };
}

export function canEditMasala(
  row: Pick<StoredVerifiedAnswer, "author">,
  reviewer: Pick<Reviewer, "role" | "principalId">,
): boolean {
  return isAdminReviewer(reviewer) || row.author?.id === reviewer.principalId;
}

function iso(value: Date | undefined): string | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

function excerpt(answer: string | undefined): string {
  return markdownExcerpt(answer ?? "", 200);
}

export function toWorkspaceMasala(row: StoredVerifiedAnswer, reviewer: Reviewer): WorkspaceMasala {
  const id = row._id.toHexString();
  const canEdit = canEditMasala(row, reviewer);
  const published = row.published === true;
  return {
    id,
    question: row.question,
    excerpt: excerpt(row.answer),
    category: row.category ?? null,
    author: row.author ?? null,
    published,
    publishedAt: iso(row.publishedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    updatedBy: canEdit ? (row.updatedBy ?? null) : null,
    sourceCount: Array.isArray(row.sources) ? row.sources.length : 0,
    servedCount: typeof row.servedCount === "number" ? row.servedCount : 0,
    canEdit,
    path: published ? masalaPath(id) : null,
  };
}

function toDetail(row: StoredVerifiedAnswer, reviewer: Reviewer): WorkspaceMasalaDetail {
  const summary = toWorkspaceMasala(row, reviewer);
  return {
    ...summary,
    answer: row.answer,
    sources: Array.isArray(row.sources) ? row.sources : [],
    reviewerNote: summary.canEdit ? (row.reviewerNote ?? "") : "",
  };
}

export async function listWorkspace(
  options: { tab: WorkspaceTab; search?: string; authorId?: string; cursor?: string },
  reviewer: Reviewer,
): Promise<{ items: WorkspaceMasala[]; total: number | null; nextCursor: string | null }> {
  if (options.tab === "all" && !isAdminReviewer(reviewer)) {
    throw new AdminError("সবার মাসআলা দেখার অনুমতি শুধু অ্যাডমিনের।", 403);
  }
  const cursor = options.cursor ? parseScholarCursor(options.cursor) : null;
  if (options.cursor && !cursor) throw new AdminError("পাতার কার্সর সঠিক নয়।");

  const { rows, total, nextCursor } = await listScholarAnswers({
    authorId:
      options.tab === "mine"
        ? reviewer.principalId
        : options.tab === "all"
          ? options.authorId || undefined
          : undefined,
    published: options.tab === "published",
    search: options.search,
    cursor,
    limit: 25,
  });

  return { items: rows.map((row) => toWorkspaceMasala(row, reviewer)), total, nextCursor };
}

async function scholarRow(id: string): Promise<StoredVerifiedAnswer> {
  const row = await getVerifiedAnswerById(id.trim());
  if (!row || !isScholarAnswer(row)) throw new AdminError("মাসআলাটি পাওয়া যায়নি।", 404);
  return row;
}

async function editableRow(id: string, reviewer: Reviewer): Promise<StoredVerifiedAnswer> {
  const row = await scholarRow(id);
  if (!canEditMasala(row, reviewer)) {
    throw new AdminError("অন্য আলেমের মাসআলা বদলানো বা মুছে ফেলার অনুমতি আপনার নেই।", 403);
  }
  return row;
}

export async function getWorkspaceMasala(
  id: string,
  reviewer: Reviewer,
): Promise<WorkspaceMasalaDetail> {
  const row = await scholarRow(id);
  if (!canEditMasala(row, reviewer) && row.published !== true) {
    throw new AdminError("মাসআলাটি পাওয়া যায়নি।", 404);
  }
  return toDetail(row, reviewer);
}

export function conflictMessage(row: Pick<StoredVerifiedAnswer, "question" | "author">): string {
  const by = row.author ? ` (${row.author.category} ${row.author.name})` : "";
  return `এই প্রশ্নে আগে থেকেই একটি মাসআলা আছে${by}: "${row.question}"। সেটিই সম্পাদনা করুন।`;
}

export async function publishScholarAnswer(options: {
  id?: string;
  question: string;
  answer: string;
  sources: AnswerSource[];
  category?: string;
  published: boolean;
  reviewerNote?: string;
  author?: MasalaAuthor;
  reviewer: Reviewer;
  reuseOwn?: boolean;
}): Promise<{ id: string; replacedOwn: boolean }> {
  const normalized = normalizeQuestion(options.question);
  if (!normalized) throw new AdminError("প্রশ্নে অন্তত একটি শব্দ থাকতে হবে।");

  const others = await findAnswersForQuestion(normalized, options.id);
  let targetId = options.id;
  let replacedOwn = false;
  for (const row of others) {
    if (!isScholarAnswer(row)) continue;
    const own = row.author?.id === options.reviewer.principalId;
    if (options.reuseOwn && !options.id && own && !targetId) {
      targetId = row._id.toHexString();
      replacedOwn = true;
      continue;
    }
    throw new AdminError(conflictMessage(row), 409);
  }

  await removeAutoVerifiedForQuestion(normalized, targetId);
  const id = await saveScholarAnswer({
    id: targetId,
    question: options.question,
    answer: options.answer,
    sources: options.sources,
    ...(options.category ? { category: options.category } : {}),
    published: options.published,
    reviewerNote: options.reviewerNote,
    author: options.author,
    actor: options.reviewer.email,
  });
  return { id, replacedOwn };
}

export async function createMasala(
  input: MasalaInput,
  reviewer: Reviewer,
): Promise<WorkspaceMasalaDetail> {
  const sources = await validatedSources(input.sources);
  const { id } = await publishScholarAnswer({
    question: input.question,
    answer: input.answer,
    sources,
    category: input.category,
    published: input.published,
    reviewerNote: input.reviewerNote,
    author: authorOf(reviewer),
    reviewer,
  });
  return toDetail(await scholarRow(id), reviewer);
}

export async function updateMasala(
  id: string,
  input: MasalaInput,
  reviewer: Reviewer,
): Promise<{ previous: WorkspaceMasalaDetail; updated: WorkspaceMasalaDetail }> {
  const row = await editableRow(id, reviewer);
  const sources = await validatedSources(input.sources);
  await publishScholarAnswer({
    id: row._id.toHexString(),
    question: input.question,
    answer: input.answer,
    sources,
    category: input.category,
    published: input.published,
    reviewerNote: input.reviewerNote,
    author: row.author,
    reviewer,
  });
  return {
    previous: toDetail(row, reviewer),
    updated: toDetail(await scholarRow(id), reviewer),
  };
}

export async function setMasalaPublished(
  id: string,
  published: boolean,
  reviewer: Reviewer,
): Promise<{ question: string; changed: boolean; detail: WorkspaceMasalaDetail }> {
  const row = await editableRow(id, reviewer);
  const changed = (row.published === true) !== published;
  if (changed) await setScholarAnswerPublished(id, published, reviewer.email);
  return { question: row.question, changed, detail: toDetail(await scholarRow(id), reviewer) };
}

export async function deleteMasala(id: string, reviewer: Reviewer): Promise<StoredVerifiedAnswer> {
  const row = await editableRow(id, reviewer);
  if (!(await deleteVerifiedAnswerById(row._id.toHexString()))) {
    throw new AdminError("মাসআলাটি পাওয়া যায়নি।", 404);
  }
  return row;
}
