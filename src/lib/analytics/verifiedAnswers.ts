import { ObjectId, type Filter } from "mongodb";
import { DB_CONFIG, MASAIL_CONFIG, VERIFIED_ANSWER_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { topicKey } from "@/lib/learning/topicKey";
import { logger } from "@/lib/utils/logger";
import type { AnswerSource } from "@/types";

export type VerifiedOrigin = "auto" | "scholar";

export interface MasalaAuthor {
  id: string;
  name: string;
  category: string;
}

export interface VerifiedAnswer {
  _id?: ObjectId;
  question: string;
  normalizedQuestion: string;
  topic?: string;
  origin?: VerifiedOrigin;
  answer: string;
  sources: AnswerSource[];
  reviewerNote?: string;
  author?: MasalaAuthor;
  published?: boolean;
  publishedAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
  createdAt: Date;
  servedCount: number;
}

export interface MasalaSummary {
  id: string;
  question: string;
  excerpt: string;
  author: MasalaAuthor | null;
  publishedAt: string | null;
  path: string;
}

export interface MasalaDetail extends MasalaSummary {
  answer: string;
  sources: AnswerSource[];
  updatedAt: string | null;
}

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function masalaPath(id: string): string {
  return `${MASAIL_CONFIG.path}/${id}`;
}

async function collection() {
  const db = await getDb();
  return db.collection<VerifiedAnswer>(DB_CONFIG.verifiedAnswerCollection);
}

let masailIndexes: Promise<void> | null = null;

function ensureMasailIndexes(): Promise<void> {
  masailIndexes ??= collection()
    .then((verified) =>
      verified.createIndex(
        { publishedAt: -1, _id: -1 },
        { partialFilterExpression: { published: true }, name: "published_masail" },
      ),
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      masailIndexes = null;
      logger.warn("Masail index creation failed", { error: String(error).slice(0, 160) });
    });
  return masailIndexes;
}

export async function saveVerifiedAnswer(input: {
  question: string;
  answer: string;
  sources: AnswerSource[];
  reviewerNote?: string;
  origin?: VerifiedOrigin;
}): Promise<void> {
  const verified = await collection();
  const normalizedQuestion = normalizeQuestion(input.question);
  const origin = input.origin ?? "scholar";

  if (origin === "auto" && (await verified.findOne({ normalizedQuestion, origin: "scholar" }))) {
    return;
  }

  await verified.updateOne(
    { normalizedQuestion },
    {
      $set: {
        question: input.question,
        normalizedQuestion,
        topic: topicKey(input.question),
        origin,
        answer: input.answer,
        sources: input.sources,
        reviewerNote: input.reviewerNote,
        createdAt: new Date(),
      },
      $setOnInsert: { servedCount: 0 },
    },
    { upsert: true },
  );

  logger.info("Stored verified answer", { origin, question: input.question.slice(0, 80) });
}

export async function saveScholarAnswer(input: {
  id?: string;
  question: string;
  answer: string;
  sources: AnswerSource[];
  author?: MasalaAuthor;
  published: boolean;
  reviewerNote?: string;
  actor: string;
}): Promise<string> {
  const verified = await collection();
  const normalizedQuestion = normalizeQuestion(input.question);
  const now = new Date();
  const existing =
    input.id && ObjectId.isValid(input.id)
      ? await verified.findOne({ _id: new ObjectId(input.id) })
      : await verified.findOne({ normalizedQuestion });
  const note = input.reviewerNote?.trim();
  const fields = {
    question: input.question,
    normalizedQuestion,
    topic: topicKey(input.question),
    origin: "scholar" as const,
    answer: input.answer,
    sources: input.sources,
    ...(note ? { reviewerNote: note } : {}),
    ...(input.author ? { author: input.author } : {}),
    published: input.published,
    updatedAt: now,
    updatedBy: input.actor,
  };

  if (existing?._id) {
    const unset = {
      ...(note ? {} : { reviewerNote: "" as const }),
      ...(input.published ? {} : { publishedAt: "" as const }),
    };
    await verified.updateOne(
      { _id: existing._id },
      {
        $set: {
          ...fields,
          ...(input.published && !(existing.published && existing.publishedAt)
            ? { publishedAt: now }
            : {}),
        },
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
    );
    return existing._id.toHexString();
  }

  const result = await verified.insertOne({
    ...fields,
    ...(input.published ? { publishedAt: now } : {}),
    createdAt: now,
    servedCount: 0,
  });
  return result.insertedId.toHexString();
}

export type StoredVerifiedAnswer = VerifiedAnswer & { _id: ObjectId };

export interface ScholarAnswerCursor {
  createdAt: Date | null;
  id: ObjectId;
}

export function isScholarAnswer(row: Pick<VerifiedAnswer, "origin">): boolean {
  return row.origin !== "auto";
}

export function encodeScholarCursor(row: { _id: ObjectId; createdAt?: Date }): string {
  const time =
    row.createdAt instanceof Date && !Number.isNaN(row.createdAt.getTime())
      ? String(row.createdAt.getTime())
      : "-";
  return `${time}.${row._id.toHexString()}`;
}

export function parseScholarCursor(value: string): ScholarAnswerCursor | null {
  const match = /^(-|\d{1,16})\.([0-9a-f]{24})$/i.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  return {
    createdAt: match[1] === "-" ? null : new Date(Number(match[1])),
    id: new ObjectId(match[2]),
  };
}

export function scholarAnswersAfter(cursor: ScholarAnswerCursor): Filter<VerifiedAnswer> {
  if (cursor.createdAt === null) {
    return { createdAt: { $not: { $type: "date" } }, _id: { $lt: cursor.id } };
  }
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: { $not: { $type: "date" } } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
}

export function scholarAnswerFilter(options: {
  authorId?: string;
  published?: boolean;
  search?: string;
}): Filter<VerifiedAnswer> {
  const search = options.search?.trim().slice(0, MASAIL_CONFIG.maxSearchChars);
  return {
    origin: { $ne: "auto" },
    ...(options.authorId ? { "author.id": options.authorId } : {}),
    ...(options.published ? { published: true } : {}),
    ...(search ? { question: { $regex: escapeRegex(search), $options: "i" } } : {}),
  };
}

let authorIndexes: Promise<void> | null = null;

function ensureAuthorIndexes(): Promise<void> {
  authorIndexes ??= collection()
    .then((verified) =>
      verified.createIndex(
        { "author.id": 1, createdAt: -1, _id: -1 },
        { partialFilterExpression: { "author.id": { $exists: true } }, name: "masail_author" },
      ),
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      authorIndexes = null;
      logger.warn("Masail author index creation failed", { error: String(error).slice(0, 160) });
    });
  return authorIndexes;
}

export async function listScholarAnswers(options: {
  authorId?: string;
  published?: boolean;
  search?: string;
  cursor?: ScholarAnswerCursor | null;
  limit: number;
}): Promise<{ rows: StoredVerifiedAnswer[]; total: number | null; nextCursor: string | null }> {
  await Promise.all([ensureAuthorIndexes(), ensureMasailIndexes()]);
  const filter = scholarAnswerFilter(options);
  const verified = await collection();
  const [total, rows] = await Promise.all([
    options.cursor ? Promise.resolve(null) : verified.countDocuments(filter),
    verified
      .find(options.cursor ? { $and: [filter, scholarAnswersAfter(options.cursor)] } : filter, {
        projection: { normalizedQuestion: 0 },
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(options.limit + 1)
      .toArray(),
  ]);
  const page = rows.slice(0, options.limit) as StoredVerifiedAnswer[];
  const last = page.at(-1);
  return {
    rows: page,
    total,
    nextCursor: rows.length > options.limit && last ? encodeScholarCursor(last) : null,
  };
}

export async function getVerifiedAnswerById(id: string): Promise<StoredVerifiedAnswer | null> {
  if (!/^[0-9a-f]{24}$/i.test(id)) return null;
  return (await (
    await collection()
  ).findOne({
    _id: new ObjectId(id),
  })) as StoredVerifiedAnswer | null;
}

export async function deleteVerifiedAnswerById(id: string): Promise<boolean> {
  if (!/^[0-9a-f]{24}$/i.test(id)) return false;
  const { deletedCount } = await (await collection()).deleteOne({ _id: new ObjectId(id) });
  return deletedCount === 1;
}

export async function findAnswersForQuestion(
  normalizedQuestion: string,
  exceptId?: string,
): Promise<StoredVerifiedAnswer[]> {
  const filter: Filter<VerifiedAnswer> = { normalizedQuestion };
  if (exceptId && ObjectId.isValid(exceptId)) filter._id = { $ne: new ObjectId(exceptId) };
  return (await (
    await collection()
  )
    .find(filter, { projection: { answer: 0, sources: 0 } })
    .limit(10)
    .toArray()) as StoredVerifiedAnswer[];
}

export async function removeAutoVerifiedForQuestion(
  normalizedQuestion: string,
  exceptId?: string,
): Promise<number> {
  const filter: Filter<VerifiedAnswer> = { normalizedQuestion, origin: "auto" };
  if (exceptId && ObjectId.isValid(exceptId)) filter._id = { $ne: new ObjectId(exceptId) };
  const { deletedCount } = await (await collection()).deleteMany(filter);
  return deletedCount;
}

export async function setScholarAnswerPublished(
  id: string,
  published: boolean,
  actor: string,
): Promise<boolean> {
  if (!/^[0-9a-f]{24}$/i.test(id)) return false;
  const _id = new ObjectId(id);
  const now = new Date();
  const verified = await collection();
  const result = published
    ? await verified.updateOne({ _id, origin: { $ne: "auto" } }, [
        {
          $set: {
            published: true,
            publishedAt: { $ifNull: ["$publishedAt", now] },
            updatedAt: now,
            updatedBy: actor,
          },
        },
      ])
    : await verified.updateOne(
        { _id, origin: { $ne: "auto" } },
        {
          $set: { published: false, updatedAt: now, updatedBy: actor },
          $unset: { publishedAt: "" },
        },
      );
  return result.matchedCount === 1;
}

export interface ScholarAuthorCount extends MasalaAuthor {
  count: number;
}

export async function listScholarAuthors(): Promise<ScholarAuthorCount[]> {
  const rows = await (
    await collection()
  )
    .aggregate<{ _id: string; name: string; category: string; count: number }>([
      { $match: { origin: { $ne: "auto" }, "author.id": { $exists: true } } },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: "$author.id",
          name: { $first: "$author.name" },
          category: { $first: "$author.category" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, name: 1 } },
      { $limit: 500 },
    ])
    .toArray();
  return rows.map((row) => ({
    id: row._id,
    name: row.name,
    category: row.category,
    count: row.count,
  }));
}

function excerpt(answer: string): string {
  const plain = answer
    .replace(/[#>*_`[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 220 ? `${plain.slice(0, 220).trimEnd()}…` : plain;
}

function toSummary(row: VerifiedAnswer & { _id: ObjectId }): MasalaSummary {
  const id = row._id.toHexString();
  return {
    id,
    question: row.question,
    excerpt: excerpt(row.answer),
    author: row.author ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    path: masalaPath(id),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listPublishedMasail(options: {
  search?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: MasalaSummary[]; nextCursor: string | null }> {
  await ensureMasailIndexes();
  const limit = options.limit ?? MASAIL_CONFIG.pageSize;
  const filter: Filter<VerifiedAnswer> = { published: true, origin: "scholar" };
  const search = options.search?.trim().slice(0, MASAIL_CONFIG.maxSearchChars);
  if (search) filter.question = { $regex: escapeRegex(search), $options: "i" };

  if (options.cursor) {
    const [time, id] = options.cursor.split("_");
    const at = new Date(Number(time));
    if (id && ObjectId.isValid(id) && !Number.isNaN(at.getTime())) {
      filter.$or = [
        { publishedAt: { $lt: at } },
        { publishedAt: at, _id: { $lt: new ObjectId(id) } },
      ];
    }
  }

  const rows = (await (
    await collection()
  )
    .find(filter, { projection: { sources: 0, normalizedQuestion: 0 } })
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray()) as (VerifiedAnswer & { _id: ObjectId })[];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(toSummary),
    nextCursor:
      rows.length > limit && last?.publishedAt
        ? `${last.publishedAt.getTime()}_${last._id.toHexString()}`
        : null,
  };
}

export async function getPublishedMasala(id: string): Promise<MasalaDetail | null> {
  if (!ObjectId.isValid(id)) return null;
  const row = (await (
    await collection()
  ).findOne({ _id: new ObjectId(id), published: true, origin: "scholar" })) as
    (VerifiedAnswer & { _id: ObjectId }) | null;
  if (!row) return null;
  return {
    ...toSummary(row),
    answer: row.answer,
    sources: row.sources,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function findVerifiedAnswer(question: string): Promise<VerifiedAnswer | null> {
  if (!VERIFIED_ANSWER_CONFIG.enabled) return null;

  try {
    const verified = await collection();
    const normalizedQuestion = normalizeQuestion(question);

    const topic = topicKey(question);
    const match =
      (await verified.findOne({ normalizedQuestion }, { sort: { origin: -1 } })) ??
      (VERIFIED_ANSWER_CONFIG.matchByTopic && topic.includes(" ")
        ? await verified.findOne({ topic }, { sort: { origin: -1, createdAt: -1 } })
        : null);
    if (!match) return null;

    await verified.updateOne({ _id: match._id }, { $inc: { servedCount: 1 } });
    return match;
  } catch (error) {
    logger.warn("Verified answer lookup failed", { error: String(error).slice(0, 160) });
    return null;
  }
}

export async function listVerifiedAnswers(limit = 100) {
  const verified = await collection();
  return verified.find().sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function withdrawAutoVerified(question: string): Promise<number> {
  try {
    const verified = await collection();
    const { deletedCount } = await verified.deleteMany({
      origin: "auto",
      $or: [{ normalizedQuestion: normalizeQuestion(question) }, { topic: topicKey(question) }],
    });
    if (deletedCount > 0) {
      logger.info("Withdrew an automatically verified answer after negative feedback", {
        question: question.slice(0, 80),
      });
    }
    return deletedCount;
  } catch (error) {
    logger.warn("Verified answer withdrawal failed", { error: String(error).slice(0, 160) });
    return 0;
  }
}

export async function deleteVerifiedAnswer(normalizedQuestion: string): Promise<boolean> {
  const verified = await collection();
  const { deletedCount } = await verified.deleteOne({ normalizedQuestion });
  return deletedCount === 1;
}
