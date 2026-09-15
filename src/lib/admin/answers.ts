import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { ADMIN_CONFIG, DB_CONFIG, RATE_LIMIT_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { AdminError } from "@/lib/admin/http";
import { preferredGrade } from "@/lib/ai/hadithGrade";
import { normalizeQuestion, type VerifiedAnswer } from "@/lib/analytics/verifiedAnswers";
import { getDb } from "@/lib/db/mongoClient";
import { topicKey } from "@/lib/learning/topicKey";
import { findChunksByReferences } from "@/lib/retrieval/vectorStore";
import type { AnswerSource, SourceType } from "@/types";

export const ANSWER_LIMITS = {
  answerChars: 20_000,
  reviewerNoteChars: 1_000,
  referenceChars: 400,
  maxSources: 20,
  searchChars: 200,
} as const;

interface AdminVerifiedAnswer extends VerifiedAnswer {
  updatedAt?: Date;
  updatedBy?: string;
  createdBy?: string;
}

export const answerSourceInput = z.object({
  sourceType: z.enum(SOURCE_PRIORITY),
  reference: z.string().trim().min(1).max(ANSWER_LIMITS.referenceChars),
});

export const answerInput = z.object({
  question: z.string().trim().min(1).max(RATE_LIMIT_CONFIG.maxQuestionChars),
  answer: z.string().trim().min(1).max(ANSWER_LIMITS.answerChars),
  origin: z.enum(["scholar", "auto"]),
  reviewerNote: z.string().trim().max(ANSWER_LIMITS.reviewerNoteChars).default(""),
  sources: z.array(answerSourceInput).max(ANSWER_LIMITS.maxSources),
});

export type AnswerInput = z.infer<typeof answerInput>;
export type AnswerSourceInput = z.infer<typeof answerSourceInput>;

export interface AnswerSummary {
  id: string;
  question: string;
  origin: "scholar" | "auto";
  servedCount: number;
  sourceCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AnswerDetail extends AnswerSummary {
  answer: string;
  reviewerNote: string;
  topic: string;
  sources: AnswerSource[];
  updatedBy: string | null;
}

async function collection() {
  return (await getDb()).collection<AdminVerifiedAnswer>(DB_CONFIG.verifiedAnswerCollection);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseId(id: string): ObjectId {
  const trimmed = id.trim();
  if (!/^[0-9a-f]{24}$/i.test(trimmed)) throw new AdminError("উত্তরটি পাওয়া যায়নি।", 404);
  return new ObjectId(trimmed);
}

function iso(value: Date | undefined): string | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
}

function summary(row: AdminVerifiedAnswer & { _id: ObjectId }): AnswerSummary {
  return {
    id: row._id.toHexString(),
    question: row.question,
    origin: row.origin === "auto" ? "auto" : "scholar",
    servedCount: typeof row.servedCount === "number" ? row.servedCount : 0,
    sourceCount: Array.isArray(row.sources) ? row.sources.length : 0,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export interface AnswerCursor {
  createdAt: Date | null;
  id: ObjectId;
}

export function encodeAnswerCursor(row: { _id: ObjectId; createdAt?: Date }): string {
  const time =
    row.createdAt instanceof Date && !Number.isNaN(row.createdAt.getTime())
      ? String(row.createdAt.getTime())
      : "-";
  return `${time}.${row._id.toHexString()}`;
}

export function parseAnswerCursor(value: string): AnswerCursor {
  const match = /^(-|\d{1,16})\.([0-9a-f]{24})$/i.exec(value.trim());
  if (!match?.[1] || !match[2]) throw new AdminError("পাতার কার্সর সঠিক নয়।");
  return {
    createdAt: match[1] === "-" ? null : new Date(Number(match[1])),
    id: new ObjectId(match[2]),
  };
}

export function answersAfter(cursor: AnswerCursor): Filter<AdminVerifiedAnswer> {
  if (cursor.createdAt === null)
    return { createdAt: { $not: { $type: "date" } }, _id: { $lt: cursor.id } };
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: { $not: { $type: "date" } } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
}

export async function listAnswers(options: {
  search?: string;
  origin?: "scholar" | "auto";
  cursor?: string;
}): Promise<{ items: AnswerSummary[]; total: number; nextCursor: string | null }> {
  const search = options.search?.trim().slice(0, ANSWER_LIMITS.searchChars) ?? "";
  const filter: Filter<AdminVerifiedAnswer> = {
    ...(search ? { question: { $regex: escapeRegex(search), $options: "i" } } : {}),
    ...(options.origin === "auto"
      ? { origin: "auto" }
      : options.origin === "scholar"
        ? { origin: { $ne: "auto" } }
        : {}),
  };
  const cursor = options.cursor ? parseAnswerCursor(options.cursor) : null;
  const answers = await collection();
  const pageSize = ADMIN_CONFIG.pageSize;

  const [total, rows] = await Promise.all([
    answers.countDocuments(filter),
    answers
      .find(cursor ? { $and: [filter, answersAfter(cursor)] } : filter, {
        projection: { answer: 0 },
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize + 1)
      .toArray(),
  ]);

  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  return {
    items: page.map(summary),
    total,
    nextCursor: rows.length > pageSize && last ? encodeAnswerCursor(last) : null,
  };
}

export async function getAnswer(id: string): Promise<AnswerDetail> {
  const row = await (await collection()).findOne({ _id: parseId(id) });
  if (!row) throw new AdminError("উত্তরটি পাওয়া যায়নি।", 404);
  return {
    ...summary(row),
    answer: row.answer,
    reviewerNote: row.reviewerNote ?? "",
    topic: row.topic ?? topicKey(row.question),
    sources: Array.isArray(row.sources) ? row.sources : [],
    updatedBy: row.updatedBy ?? null,
  };
}

export interface ReferenceCheck {
  sourceType: SourceType;
  reference: string;
  found: boolean;
  foundSourceType?: SourceType;
}

export async function resolveSources(
  inputs: AnswerSourceInput[],
): Promise<{ sources: AnswerSource[]; checks: ReferenceCheck[] }> {
  const seen = new Set<string>();
  for (const input of inputs) {
    const key = `${input.sourceType}|${input.reference}`;
    if (seen.has(key)) {
      throw new AdminError(`একই রেফারেন্স দুইবার দেওয়া হয়েছে: ${input.reference}`);
    }
    seen.add(key);
  }

  const chunks = await findChunksByReferences([...new Set(inputs.map((input) => input.reference))]);
  const checks: ReferenceCheck[] = [];
  const sources: AnswerSource[] = [];

  for (const input of inputs) {
    const matches = chunks.filter((chunk) => chunk.citation.reference === input.reference);
    const chunk = matches.find((candidate) => candidate.sourceType === input.sourceType);
    checks.push({
      sourceType: input.sourceType,
      reference: input.reference,
      found: Boolean(chunk),
      ...(!chunk && matches[0] ? { foundSourceType: matches[0].sourceType } : {}),
    });
    if (!chunk) continue;

    const grade = preferredGrade(chunk.grades);
    sources.push({
      index: sources.length + 1,
      sourceType: chunk.sourceType,
      reference: chunk.citation.reference,
      ...(chunk.citation.url ? { url: chunk.citation.url } : {}),
      ...(chunk.citation.media ? { media: chunk.citation.media } : {}),
      ...(chunk.citation.page !== undefined ? { page: chunk.citation.page } : {}),
      ...(chunk.citation.pageCount !== undefined ? { pageCount: chunk.citation.pageCount } : {}),
      similarity: 0,
      ...(grade ? { grade } : {}),
    });
  }

  return { sources, checks };
}

async function validatedSources(inputs: AnswerSourceInput[]): Promise<AnswerSource[]> {
  const { sources, checks } = await resolveSources(inputs);
  const missing = checks.filter((check) => !check.found).map((check) => check.reference);
  if (missing.length > 0) {
    throw new AdminError(
      `এই রেফারেন্সগুলো দলিল ভান্ডারে পাওয়া যায়নি: ${missing.join(", ")}`,
      422,
    );
  }
  return sources;
}

async function refuseDuplicate(normalizedQuestion: string, exceptId?: ObjectId): Promise<void> {
  const existing = await (
    await collection()
  ).findOne(
    { normalizedQuestion, ...(exceptId ? { _id: { $ne: exceptId } } : {}) },
    { projection: { _id: 1 } },
  );
  if (existing) {
    throw new AdminError("এই প্রশ্নের একটি যাচাইকৃত উত্তর আগে থেকেই আছে।", 409);
  }
}

export async function createAnswer(input: AnswerInput, email: string): Promise<AnswerDetail> {
  const normalizedQuestion = normalizeQuestion(input.question);
  if (!normalizedQuestion) throw new AdminError("প্রশ্নে অন্তত একটি শব্দ থাকতে হবে।");
  await refuseDuplicate(normalizedQuestion);
  const sources = await validatedSources(input.sources);
  const now = new Date();

  const { insertedId } = await (
    await collection()
  ).insertOne({
    question: input.question,
    normalizedQuestion,
    topic: topicKey(input.question),
    origin: input.origin,
    answer: input.answer,
    sources,
    ...(input.reviewerNote ? { reviewerNote: input.reviewerNote } : {}),
    createdAt: now,
    servedCount: 0,
    createdBy: email,
    updatedAt: now,
    updatedBy: email,
  });

  return getAnswer(insertedId.toHexString());
}

export async function updateAnswer(
  id: string,
  input: AnswerInput,
  email: string,
): Promise<AnswerDetail> {
  const _id = parseId(id);
  const normalizedQuestion = normalizeQuestion(input.question);
  if (!normalizedQuestion) throw new AdminError("প্রশ্নে অন্তত একটি শব্দ থাকতে হবে।");
  await refuseDuplicate(normalizedQuestion, _id);
  const sources = await validatedSources(input.sources);

  const result = await (
    await collection()
  ).updateOne(
    { _id },
    {
      $set: {
        question: input.question,
        normalizedQuestion,
        topic: topicKey(input.question),
        origin: input.origin,
        answer: input.answer,
        sources,
        updatedAt: new Date(),
        updatedBy: email,
        ...(input.reviewerNote ? { reviewerNote: input.reviewerNote } : {}),
      },
      ...(input.reviewerNote ? {} : { $unset: { reviewerNote: "" } }),
    },
  );
  if (result.matchedCount === 0) throw new AdminError("উত্তরটি পাওয়া যায়নি।", 404);

  return getAnswer(id);
}

export async function removeAnswer(id: string): Promise<string> {
  const row = await (
    await collection()
  ).findOneAndDelete({ _id: parseId(id) }, { projection: { question: 1 } });
  if (!row) throw new AdminError("উত্তরটি পাওয়া যায়নি।", 404);
  return row.question;
}
