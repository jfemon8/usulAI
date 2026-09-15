import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { ADMIN_CONFIG, DATE_TIME_CONFIG, DB_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import { AdminError } from "@/lib/admin/errors";
import type { GateRejection, QueryLogEntry } from "@/lib/analytics/queryLog";
import type { Insight } from "@/lib/maintenance/retention";
import { getDb } from "@/lib/db/mongoClient";

const DAY_MS = 86_400_000;
const LIST_QUESTION_CHARS = 280;
const TOP_MODELS = 6;
const TOP_QUESTIONS = 10;

export const MONITOR_RANGES = ["today", "7d", "30d"] as const;
export const MONITOR_STATUSES = ["all", "unanswered", "answered"] as const;
export const MONITOR_LANGUAGES = ["bangla", "banglish", "other"] as const;

export type MonitorRange = (typeof MONITOR_RANGES)[number];

const filterSchema = z.object({
  range: z.enum(MONITOR_RANGES).catch("7d"),
  status: z.enum(MONITOR_STATUSES).catch("all"),
  language: z.enum(MONITOR_LANGUAGES).optional().catch(undefined),
  source: z.enum(SOURCE_PRIORITY).optional().catch(undefined),
  model: z.string().trim().min(1).max(120).optional().catch(undefined),
  cursor: z.string().max(80).optional().catch(undefined),
});

export type MonitorFilters = z.infer<typeof filterSchema>;

type StoredLog = QueryLogEntry & { _id: ObjectId } & Record<string, unknown>;

export interface LogCursor {
  createdAt: Date;
  id: ObjectId;
}

export function parseMonitorFilters(params: URLSearchParams): MonitorFilters {
  const read = (name: string) => params.get(name) || undefined;
  return filterSchema.parse({
    range: read("range"),
    status: read("status"),
    language: read("language"),
    source: read("source"),
    model: read("model"),
    cursor: read("cursor"),
  });
}

export function startOfDay(now: number, timeZone: string = DATE_TIME_CONFIG.timeZone): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(now))
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  const wall = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  const offset = Math.round((wall - Math.floor(now / 1000) * 1000) / 60_000) * 60_000;
  return new Date(Date.UTC(parts.year ?? 1970, (parts.month ?? 1) - 1, parts.day ?? 1) - offset);
}

export function rangeStart(range: MonitorRange, now: number): Date {
  if (range === "today") return startOfDay(now);
  return new Date(now - (range === "7d" ? 7 : 30) * DAY_MS);
}

export function encodeLogCursor(row: { createdAt: Date; _id: ObjectId }): string {
  return `${row.createdAt.getTime()}.${row._id.toHexString()}`;
}

export function parseLogCursor(value: string): LogCursor {
  const match = /^(\d{1,15})\.([a-f0-9]{24})$/.exec(value);
  if (!match?.[1] || !match[2]) throw new AdminError("তালিকার অবস্থান সঠিক নয়।");
  return { createdAt: new Date(Number(match[1])), id: new ObjectId(match[2]) };
}

export const UNANSWERED_CLAUSE: Filter<QueryLogEntry> = {
  $or: [{ answered: false }, { retrievedCount: 0 }],
};

export function monitorFilter(filters: MonitorFilters, now: number): Filter<QueryLogEntry> {
  const filter: Filter<QueryLogEntry> = { createdAt: { $gte: rangeStart(filters.range, now) } };
  const and: Filter<QueryLogEntry>[] = [];

  if (filters.status === "unanswered") and.push(UNANSWERED_CLAUSE);
  if (filters.status === "answered") {
    filter.answered = true;
    filter.retrievedCount = { $gt: 0 };
  }
  if (filters.language) filter.language = filters.language;
  if (filters.source) filter.scopedTo = filters.source;
  if (filters.model) filter.modelId = filters.model;

  if (filters.cursor) {
    const cursor = parseLogCursor(filters.cursor);
    and.push({
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ],
    });
  }

  return and.length > 0 ? { ...filter, $and: and } : filter;
}

export interface MonitorLogRow {
  id: string;
  question: string;
  language: string;
  answered: boolean;
  noContext: boolean;
  modelId: string | null;
  modelTier: string | null;
  retrievedCount: number;
  gateRejections: number;
  loopCut: boolean;
  createdAt: string;
}

function rejectionsOf(row: { gateRejections?: GateRejection[] | null }): GateRejection[] {
  return Array.isArray(row.gateRejections) ? row.gateRejections : [];
}

export function toLogRow(row: StoredLog): MonitorLogRow {
  const question = String(row.question ?? "");
  return {
    id: row._id.toHexString(),
    question:
      question.length > LIST_QUESTION_CHARS
        ? `${question.slice(0, LIST_QUESTION_CHARS).trimEnd()}…`
        : question,
    language: String(row.language ?? "other"),
    answered: row.answered === true,
    noContext: (row.retrievedCount ?? 0) === 0,
    modelId: row.modelId ?? null,
    modelTier: row.modelTier ?? null,
    retrievedCount: row.retrievedCount ?? 0,
    gateRejections: rejectionsOf(row).length,
    loopCut: row.loopCut === true,
    createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(0)).toISOString(),
  };
}

export interface MonitorLogDetail extends MonitorLogRow {
  question: string;
  searchQuery: string | null;
  rewritten: boolean;
  historyTurns: number;
  scopedTo: string[];
  sourcesUsed: string[];
  references: string[];
  topScore: number | null;
  vectorHits: number;
  textHits: number;
  attempt: number | null;
  errorTier: string | null;
  rejectionDetails: GateRejection[];
  timings: Record<string, number>;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function toLogDetail(row: StoredLog): MonitorLogDetail {
  const timings = Object.fromEntries(
    Object.entries(row).filter(
      (entry): entry is [string, number] =>
        /Ms$/.test(entry[0]) && typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
  return {
    ...toLogRow(row),
    question: String(row.question ?? ""),
    searchQuery: row.searchQuery ?? null,
    rewritten: row.rewritten === true,
    historyTurns: row.historyTurns ?? 0,
    scopedTo: stringList(row.scopedTo),
    sourcesUsed: stringList(row.sourcesUsed),
    references: stringList(row.references),
    topScore: typeof row.topScore === "number" ? row.topScore : null,
    vectorHits: row.vectorHits ?? 0,
    textHits: row.textHits ?? 0,
    attempt: typeof row.attempt === "number" ? row.attempt : null,
    errorTier: row.errorTier ?? null,
    rejectionDetails: rejectionsOf(row).map((rejection) => ({
      modelId: String(rejection.modelId ?? ""),
      reasons: stringList(rejection.reasons),
    })),
    timings,
  };
}

async function logs() {
  return (await getDb()).collection<QueryLogEntry>(DB_CONFIG.queryLogCollection);
}

const LIST_PROJECTION = {
  question: 1,
  language: 1,
  answered: 1,
  retrievedCount: 1,
  modelId: 1,
  modelTier: 1,
  gateRejections: 1,
  loopCut: 1,
  createdAt: 1,
} as const;

export async function listMonitorLogs(filters: MonitorFilters, now = Date.now()) {
  const limit = ADMIN_CONFIG.pageSize;
  const rows = (await (
    await logs()
  )
    .find(monitorFilter(filters, now), { projection: LIST_PROJECTION })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray()) as StoredLog[];

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(toLogRow),
    nextCursor:
      rows.length > limit && last && last.createdAt instanceof Date
        ? encodeLogCursor({ createdAt: last.createdAt, _id: last._id })
        : null,
  };
}

export async function getMonitorLog(id: string): Promise<MonitorLogDetail> {
  if (!ObjectId.isValid(id) || !/^[a-f0-9]{24}$/i.test(id)) {
    throw new AdminError("লগের আইডি সঠিক নয়।");
  }
  const row = (await (
    await logs()
  ).findOne({ _id: new ObjectId(id) }, { projection: { embedding: 0 } })) as StoredLog | null;
  if (!row) throw new AdminError("লগটি পাওয়া যায়নি। হয়তো মেয়াদ শেষে মুছে গেছে।", 404);
  return toLogDetail(row);
}

interface WeekTotals {
  total: number;
  unanswered: number;
  gateRejected: number;
  gateRejections: number;
  loopCuts: number;
}

export function unansweredShare(totals: Pick<WeekTotals, "total" | "unanswered">): number | null {
  return totals.total > 0 ? totals.unanswered / totals.total : null;
}

export async function monitorSummary(now = Date.now()) {
  const collection = await logs();
  const day = new Date(now - DAY_MS);
  const week = new Date(now - 7 * DAY_MS);
  const month = new Date(now - 30 * DAY_MS);
  const db = await getDb();

  const [count24h, weekTotals, topModels, models, insights] = await Promise.all([
    collection.countDocuments({ createdAt: { $gte: day } }),
    collection
      .aggregate<WeekTotals>([
        { $match: { createdAt: { $gte: week } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unanswered: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ne: ["$answered", true] },
                      { $eq: [{ $ifNull: ["$retrievedCount", 0] }, 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            gateRejected: {
              $sum: {
                $cond: [{ $gt: [{ $size: { $ifNull: ["$gateRejections", []] } }, 0] }, 1, 0],
              },
            },
            gateRejections: { $sum: { $size: { $ifNull: ["$gateRejections", []] } } },
            loopCuts: { $sum: { $cond: [{ $eq: ["$loopCut", true] }, 1, 0] } },
          },
        },
        { $project: { _id: 0 } },
      ])
      .toArray(),
    collection
      .aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: week }, answered: true, modelId: { $type: "string" } } },
        { $group: { _id: "$modelId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: TOP_MODELS },
      ])
      .toArray(),
    collection.distinct("modelId", { createdAt: { $gte: month } }),
    db
      .collection<Insight & { _id: string }>(DB_CONFIG.queryInsightsCollection)
      .find(
        { asked: { $gte: 2 } },
        {
          projection: {
            question: 1,
            language: 1,
            asked: 1,
            answered: 1,
            unanswered: 1,
            emptyRetrieval: 1,
            lastAskedAt: 1,
          },
        },
      )
      .sort({ asked: -1, lastAskedAt: -1 })
      .limit(TOP_QUESTIONS)
      .toArray(),
  ]);

  const totals = weekTotals[0] ?? {
    total: 0,
    unanswered: 0,
    gateRejected: 0,
    gateRejections: 0,
    loopCuts: 0,
  };

  return {
    generatedAt: new Date(now).toISOString(),
    count24h,
    count7d: totals.total,
    unanswered7d: totals.unanswered,
    unansweredShare: unansweredShare(totals),
    gateRejected7d: totals.gateRejected,
    gateRejections7d: totals.gateRejections,
    loopCuts7d: totals.loopCuts,
    topModels: topModels.map((row) => ({ modelId: row._id, count: row.count })),
    models: models
      .filter((value): value is string => typeof value === "string")
      .sort()
      .slice(0, 50),
    topQuestions: insights.map((row) => ({
      id: row._id,
      question: row.question,
      language: row.language ?? null,
      asked: row.asked ?? 0,
      answered: row.answered ?? 0,
      unanswered: row.unanswered ?? 0,
      emptyRetrieval: row.emptyRetrieval ?? 0,
      lastAskedAt: row.lastAskedAt instanceof Date ? row.lastAskedAt.toISOString() : null,
    })),
  };
}

export type MonitorSummary = Awaited<ReturnType<typeof monitorSummary>>;
