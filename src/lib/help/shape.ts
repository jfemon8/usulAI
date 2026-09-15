import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { HELP_CONFIG } from "@/config/site";
import { AdminError } from "@/lib/admin/errors";
import { answerSourceInput, ANSWER_LIMITS } from "@/lib/admin/answers";
import { masalaPath } from "@/lib/analytics/verifiedAnswers";
import {
  HELP_CLOSE_REASONS,
  HELP_FILTERS,
  type HelpClaimView,
  type HelpCloseReason,
  type HelpFilter,
  type HelpPermissions,
  type HelpStatus,
  type HelpSummary,
  type PublicHelpView,
} from "@/lib/help/types";
import type { AnswerSource } from "@/types";

export const HELP_LIMITS = {
  nameChars: 80,
  aiAnswerChars: 8_000,
  references: 20,
  referenceChars: 400,
  noteChars: 1_000,
  searchChars: 200,
  pageSize: 25,
  excerptChars: 140,
} as const;

const DAY_MS = 86_400_000;

export interface HelpClaim {
  principalId: string;
  name: string;
  category: string;
  email: string;
  at: Date;
  expiresAt: Date;
}

export interface HelpActorRef {
  id: string;
  name: string;
  category: string;
  email: string;
}

export interface HelpRequestDoc {
  _id: ObjectId;
  tokenDigest: string;
  question: string;
  details?: string;
  name?: string;
  email?: string;
  context?: { aiAnswer?: string; references?: string[] };
  clientKey: string;
  status: HelpStatus;
  claim?: HelpClaim;
  answer?: string;
  sources?: AnswerSource[];
  answeredBy?: HelpActorRef;
  answeredAt?: Date;
  masalaId?: string;
  published?: boolean;
  closedReason?: HelpCloseReason;
  closedNote?: string;
  closedAt?: Date;
  closedBy?: HelpActorRef;
  notification?: { sent: boolean; at: Date; error?: string };
  createdAt: Date;
  updatedAt?: Date;
  expiresAt: Date;
}

export interface HelpActor {
  principalId: string;
  name: string;
  categoryName: string;
  email: string;
  role: "admin" | "moderator" | "scholar";
  canHandle: boolean;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const helpSubmitInput = z.object({
  question: z.string().trim().min(1).max(HELP_CONFIG.maxQuestionChars),
  details: optionalText(HELP_CONFIG.maxDetailsChars),
  name: optionalText(HELP_LIMITS.nameChars),
  email: z
    .union([z.literal(""), z.email().max(254)])
    .optional()
    .transform((value) => (value ? value.trim().toLowerCase() : undefined)),
  context: z
    .object({
      aiAnswer: optionalText(HELP_LIMITS.aiAnswerChars),
      references: z
        .array(z.string().trim().min(1).max(HELP_LIMITS.referenceChars))
        .max(HELP_LIMITS.references)
        .optional(),
    })
    .optional(),
  website: z.string().max(500).optional(),
});

export type HelpSubmitInput = z.infer<typeof helpSubmitInput>;

export const helpStatusInput = z.object({
  tokens: z.array(z.string().min(1).max(120)).max(HELP_CONFIG.maxStoredRequests),
});

export const helpAnswerInput = z.object({
  action: z.literal("answer"),
  answer: z.string().trim().min(1).max(HELP_CONFIG.maxAnswerChars),
  sources: z.array(answerSourceInput).max(ANSWER_LIMITS.maxSources),
  publish: z.boolean(),
  masalaQuestion: optionalText(HELP_CONFIG.maxQuestionChars),
});

export const helpActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim") }),
  z.object({ action: z.literal("release") }),
  helpAnswerInput,
  z.object({
    action: z.literal("close"),
    reason: z.enum(HELP_CLOSE_REASONS),
    note: optionalText(HELP_LIMITS.noteChars),
  }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("reassign"), assigneeId: z.string().trim().min(1).max(254) }),
]);

export type HelpActionInput = z.infer<typeof helpActionInput>;
export type HelpAnswerInput = z.infer<typeof helpAnswerInput>;

export function retentionDate(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

export function excerpt(text: string, max: number = HELP_LIMITS.excerptChars): string {
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  const first = Array.from(local)[0] ?? "";
  return `${first}***@${domain}`;
}

export function activeClaim(doc: Pick<HelpRequestDoc, "claim" | "status">, now: Date) {
  if (doc.status !== "open" || !doc.claim) return null;
  return doc.claim.expiresAt.getTime() > now.getTime() ? doc.claim : null;
}

export function claimedByOther(
  doc: Pick<HelpRequestDoc, "claim" | "status">,
  actor: Pick<HelpActor, "principalId">,
  now: Date,
): HelpClaim | null {
  const claim = activeClaim(doc, now);
  return claim && claim.principalId !== actor.principalId ? claim : null;
}

export function permissionsFor(
  doc: Pick<HelpRequestDoc, "claim" | "status">,
  actor: HelpActor,
  now: Date,
): HelpPermissions {
  const isAdmin = actor.role === "admin";
  const handle = actor.canHandle;
  const claim = activeClaim(doc, now);
  const other = claimedByOther(doc, actor, now);
  const open = doc.status === "open";

  return {
    claim: handle && open && (!other || isAdmin),
    release:
      handle && open && Boolean(claim) && (claim?.principalId === actor.principalId || isAdmin),
    answer: handle && ((open && (!other || isAdmin)) || (doc.status === "answered" && isAdmin)),
    close: handle && ((open && (!other || isAdmin)) || (doc.status === "answered" && isAdmin)),
    reopen: isAdmin && doc.status !== "open",
    reassign: isAdmin && open,
    delete: isAdmin,
  };
}

export function filterFor(
  filter: HelpFilter,
  actor: Pick<HelpActor, "principalId">,
  now: Date,
): Filter<HelpRequestDoc> {
  switch (filter) {
    case "open":
      return {
        status: "open",
        $or: [{ claim: { $exists: false } }, { "claim.expiresAt": { $lte: now } }],
      };
    case "claimed":
      return { status: "open", "claim.expiresAt": { $gt: now } };
    case "mine":
      return {
        status: "open",
        "claim.principalId": actor.principalId,
        "claim.expiresAt": { $gt: now },
      };
    case "answered":
      return { status: "answered" };
    case "closed":
      return { status: "closed" };
    case "all":
      return {};
  }
}

export function parseFilter(value: string | null): HelpFilter {
  return (HELP_FILTERS as readonly string[]).includes(value ?? "") ? (value as HelpFilter) : "open";
}

export function oldestFirst(filter: HelpFilter): boolean {
  return filter === "open" || filter === "claimed" || filter === "mine";
}

export function encodeHelpCursor(row: { _id: ObjectId; createdAt: Date }): string {
  return `${row.createdAt.getTime()}.${row._id.toHexString()}`;
}

export function parseHelpCursor(value: string): { createdAt: Date; id: ObjectId } {
  const match = /^(\d{1,16})\.([0-9a-f]{24})$/i.exec(value.trim());
  if (!match?.[1] || !match[2]) throw new AdminError("পাতার কার্সর সঠিক নয়।");
  return { createdAt: new Date(Number(match[1])), id: new ObjectId(match[2]) };
}

export function afterCursor(
  cursor: { createdAt: Date; id: ObjectId },
  ascending: boolean,
): Filter<HelpRequestDoc> {
  const op = ascending ? "$gt" : "$lt";
  return {
    $or: [
      { createdAt: { [op]: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { [op]: cursor.id } },
    ],
  };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function claimView(
  doc: Pick<HelpRequestDoc, "claim" | "status">,
  actor: Pick<HelpActor, "principalId">,
  now: Date,
): HelpClaimView | null {
  const claim = activeClaim(doc, now);
  if (!claim) return null;
  return {
    id: claim.principalId,
    name: claim.name,
    category: claim.category,
    mine: claim.principalId === actor.principalId,
    at: claim.at.toISOString(),
    expiresAt: claim.expiresAt.toISOString(),
  };
}

export function helpSummary(doc: HelpRequestDoc, actor: HelpActor, now: Date): HelpSummary {
  return {
    id: doc._id.toHexString(),
    question: doc.question,
    status: doc.status,
    claim: claimView(doc, actor, now),
    requesterName: doc.name ?? null,
    email: doc.email ? (actor.role === "admin" ? doc.email : maskEmail(doc.email)) : null,
    hasContext: Boolean(doc.context?.aiAnswer || doc.context?.references?.length),
    createdAt: doc.createdAt.toISOString(),
    answeredAt: doc.status === "answered" ? (doc.answeredAt?.toISOString() ?? null) : null,
    answeredBy:
      doc.status === "answered" && doc.answeredBy
        ? { name: doc.answeredBy.name, category: doc.answeredBy.category }
        : null,
    closedReason: doc.status === "closed" ? (doc.closedReason ?? null) : null,
  };
}

export function publicHelpView(doc: HelpRequestDoc): PublicHelpView {
  const answered = doc.status === "answered";
  const closed = doc.status === "closed";
  return {
    status: doc.status,
    question: doc.question,
    details: doc.details ?? null,
    createdAt: doc.createdAt.toISOString(),
    answer: answered ? (doc.answer ?? null) : null,
    answeredBy:
      answered && doc.answeredBy
        ? { name: doc.answeredBy.name, category: doc.answeredBy.category }
        : null,
    answeredAt: answered ? (doc.answeredAt?.toISOString() ?? null) : null,
    sources: answered ? (doc.sources ?? []) : [],
    masalaPath: answered && doc.published && doc.masalaId ? masalaPath(doc.masalaId) : null,
    closedReason: closed ? (doc.closedReason ?? null) : null,
    closedNote: closed ? (doc.closedNote ?? null) : null,
    closedAt: closed ? (doc.closedAt?.toISOString() ?? null) : null,
  };
}
