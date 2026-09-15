import { ObjectId, type Collection, type Filter, type UpdateFilter } from "mongodb";
import { ADMIN_CONFIG, DB_CONFIG, HELP_CONFIG } from "@/config/site";
import { resolvePrincipal } from "@/lib/admin/accounts";
import { AdminError } from "@/lib/admin/errors";
import { resolveSources } from "@/lib/admin/answers";
import { can } from "@/lib/admin/roles";
import type { AdminSession } from "@/lib/admin/sessions";
import { getStaff, listStaff } from "@/lib/admin/staff";
import { masalaPath, saveScholarAnswer } from "@/lib/analytics/verifiedAnswers";
import { getDb } from "@/lib/db/mongoClient";
import { notifyHelpAnswered } from "@/lib/help/notify";
import {
  afterCursor,
  claimedByOther,
  encodeHelpCursor,
  escapeRegex,
  filterFor,
  HELP_LIMITS,
  helpSummary,
  oldestFirst,
  parseHelpCursor,
  permissionsFor,
  publicHelpView,
  retentionDate,
  type HelpActor,
  type HelpActorRef,
  type HelpAnswerInput,
  type HelpRequestDoc,
  type HelpSubmitInput,
} from "@/lib/help/shape";
import { newTrackingToken, parseHelpAccess } from "@/lib/help/tokens";
import type {
  HelpActionResponse,
  HelpAssignee,
  HelpCloseReason,
  HelpDetail,
  HelpFilter,
  HelpListResponse,
  HelpStats,
  HelpStatusItem,
  PublicHelpView,
} from "@/lib/help/types";
import { tokenDigest } from "@/lib/admin/identity";
import { findChunksByReferences } from "@/lib/retrieval/vectorStore";
import { logger } from "@/lib/utils/logger";

let indexes: Promise<void> | null = null;

async function collection(): Promise<Collection<HelpRequestDoc>> {
  return (await getDb()).collection<HelpRequestDoc>(DB_CONFIG.helpRequestCollection);
}

function ensureHelpIndexes(): Promise<void> {
  indexes ??= collection()
    .then((requests) =>
      Promise.all([
        requests.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "help_expiry" }),
        requests.createIndex({ tokenDigest: 1 }, { unique: true, name: "help_token" }),
        requests.createIndex(
          { status: 1, createdAt: -1, _id: -1 },
          { name: "help_status_created" },
        ),
        requests.createIndex({ "claim.principalId": 1, status: 1 }, { name: "help_claim" }),
      ]),
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      indexes = null;
      logger.warn("Help request index creation failed", { error: String(error).slice(0, 160) });
    });
  return indexes;
}

async function requests(): Promise<Collection<HelpRequestDoc>> {
  await ensureHelpIndexes();
  return collection();
}

export function helpActor(session: AdminSession): HelpActor {
  return {
    principalId: session.principalId,
    name: session.name,
    categoryName: session.categoryName,
    email: session.email,
    role: session.role,
    canHandle: can(session.role, "help.handle"),
  };
}

function actorRef(actor: HelpActor): HelpActorRef {
  return {
    id: actor.principalId,
    name: actor.name,
    category: actor.categoryName,
    email: actor.email,
  };
}

function parseId(id: string): ObjectId {
  if (!/^[0-9a-f]{24}$/i.test(id.trim())) throw new AdminError("প্রশ্নটি পাওয়া যায়নি।", 404);
  return new ObjectId(id.trim());
}

export async function createHelpRequest(
  input: HelpSubmitInput,
  client: string,
): Promise<{ token: string; createdAt: Date }> {
  const token = newTrackingToken();
  const now = new Date();
  const references = input.context?.references?.filter(Boolean) ?? [];
  const aiAnswer = input.context?.aiAnswer;

  await (
    await requests()
  ).insertOne({
    _id: new ObjectId(),
    tokenDigest: tokenDigest(token),
    question: input.question,
    ...(input.details ? { details: input.details } : {}),
    ...(input.name ? { name: input.name } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(aiAnswer || references.length > 0
      ? {
          context: {
            ...(aiAnswer ? { aiAnswer } : {}),
            ...(references.length > 0 ? { references: [...new Set(references)] } : {}),
          },
        }
      : {}),
    clientKey: client,
    status: "open",
    createdAt: now,
    updatedAt: now,
    expiresAt: retentionDate(now, HELP_CONFIG.openRetentionDays),
  });

  return { token, createdAt: now };
}

async function findByToken(token: string): Promise<HelpRequestDoc | null> {
  const access = parseHelpAccess(token);
  if (!access) return null;
  const store = await requests();
  return access.kind === "tracking"
    ? store.findOne({ tokenDigest: access.digest })
    : store.findOne({ _id: new ObjectId(access.id) });
}

export async function publicHelpRequest(token: string): Promise<PublicHelpView | null> {
  const doc = await findByToken(token);
  return doc ? publicHelpView(doc) : null;
}

export async function publicHelpStatuses(tokens: string[]): Promise<HelpStatusItem[]> {
  const unique = [...new Set(tokens)];
  const accesses = unique.map((token) => ({ token, access: parseHelpAccess(token) }));
  const digests = accesses.flatMap(({ access }) =>
    access?.kind === "tracking" ? [access.digest] : [],
  );
  const ids = accesses.flatMap(({ access }) =>
    access?.kind === "signed" ? [new ObjectId(access.id)] : [],
  );
  if (digests.length === 0 && ids.length === 0) {
    return unique.map((token) => ({ token, found: false, status: null, updatedAt: null }));
  }

  const rows = await (
    await requests()
  )
    .find(
      { $or: [{ tokenDigest: { $in: digests } }, { _id: { $in: ids } }] },
      { projection: { tokenDigest: 1, status: 1, updatedAt: 1, createdAt: 1 } },
    )
    .toArray();

  return accesses.map(({ token, access }) => {
    const row = access
      ? rows.find((candidate) =>
          access.kind === "tracking"
            ? candidate.tokenDigest === access.digest
            : candidate._id.toHexString() === access.id,
        )
      : undefined;
    return row
      ? {
          token,
          found: true,
          status: row.status,
          updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
        }
      : { token, found: false, status: null, updatedAt: null };
  });
}

export async function listHelpRequests(
  actor: HelpActor,
  options: { filter: HelpFilter; search?: string; cursor?: string },
): Promise<HelpListResponse> {
  const now = new Date();
  const search = options.search?.trim().slice(0, HELP_LIMITS.searchChars) ?? "";
  const searchFilter: Filter<HelpRequestDoc> = search
    ? /^[0-9a-f]{24}$/i.test(search)
      ? { _id: new ObjectId(search) }
      : { question: { $regex: escapeRegex(search), $options: "i" } }
    : {};
  const base: Filter<HelpRequestDoc> = {
    $and: [filterFor(options.filter, actor, now), searchFilter],
  };
  const ascending = oldestFirst(options.filter);
  const cursor = options.cursor ? parseHelpCursor(options.cursor) : null;
  const store = await requests();
  const direction = ascending ? 1 : -1;

  const statFilters: HelpStats = {
    open: 0,
    claimed: 0,
    mine: 0,
    answered: 0,
    closed: 0,
  };
  const statKeys = Object.keys(statFilters) as (keyof HelpStats)[];

  const [total, rows, ...counts] = await Promise.all([
    store.countDocuments(base),
    store
      .find(cursor ? { $and: [base, afterCursor(cursor, ascending)] } : base, {
        projection: { "context.aiAnswer": 0, answer: 0, sources: 0 },
      })
      .sort({ createdAt: direction, _id: direction })
      .limit(HELP_LIMITS.pageSize + 1)
      .toArray(),
    ...statKeys.map((key) => store.countDocuments(filterFor(key, actor, now))),
  ]);

  statKeys.forEach((key, index) => {
    statFilters[key] = counts[index] ?? 0;
  });

  const page = rows.slice(0, HELP_LIMITS.pageSize);
  const last = page.at(-1);
  return {
    items: page.map((row) => helpSummary(row, actor, now)),
    total,
    nextCursor: rows.length > HELP_LIMITS.pageSize && last ? encodeHelpCursor(last) : null,
    stats: statFilters,
    viewer: { canHandle: actor.canHandle, isAdmin: actor.role === "admin" },
  };
}

async function loadDoc(id: string): Promise<HelpRequestDoc> {
  const doc = await (await requests()).findOne({ _id: parseId(id) });
  if (!doc) throw new AdminError("প্রশ্নটি পাওয়া যায়নি।", 404);
  return doc;
}

async function contextSources(references: string[]) {
  if (references.length === 0) return { resolved: [], sources: [] };
  try {
    const chunks = await findChunksByReferences(references);
    const resolved = references.flatMap((reference) => {
      const chunk = chunks.find((candidate) => candidate.citation.reference === reference);
      return chunk ? [{ sourceType: chunk.sourceType, reference }] : [];
    });
    const { sources } = await resolveSources(resolved);
    return { resolved, sources };
  } catch (error) {
    logger.warn("Help context references could not be resolved", {
      error: String(error).slice(0, 160),
    });
    return { resolved: [], sources: [] };
  }
}

export async function toHelpDetail(doc: HelpRequestDoc, actor: HelpActor): Promise<HelpDetail> {
  const now = new Date();
  const references = doc.context?.references ?? [];
  const { resolved, sources } = await contextSources(references);

  return {
    ...helpSummary(doc, actor, now),
    details: doc.details ?? null,
    context: { aiAnswer: doc.context?.aiAnswer ?? null, references, sources, resolved },
    answer: doc.answer ?? null,
    sources: doc.sources ?? [],
    masalaId: doc.masalaId ?? null,
    masalaPath: doc.masalaId && doc.published ? masalaPath(doc.masalaId) : null,
    published: Boolean(doc.published),
    closedNote: doc.status === "closed" ? (doc.closedNote ?? null) : null,
    closedAt: doc.status === "closed" ? (doc.closedAt?.toISOString() ?? null) : null,
    closedBy:
      doc.status === "closed" && doc.closedBy
        ? `${doc.closedBy.category} ${doc.closedBy.name}`.trim()
        : null,
    notification: doc.notification
      ? {
          sent: doc.notification.sent,
          at: doc.notification.at.toISOString(),
          error: actor.role === "admin" ? (doc.notification.error ?? null) : null,
        }
      : null,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
    expiresAt: doc.expiresAt.toISOString(),
    can: permissionsFor(doc, actor, now),
    viewer: { canHandle: actor.canHandle, isAdmin: actor.role === "admin" },
  };
}

export async function getHelpDetail(actor: HelpActor, id: string): Promise<HelpDetail> {
  return toHelpDetail(await loadDoc(id), actor);
}

function conflict(doc: HelpRequestDoc | null, actor: HelpActor): never {
  if (!doc) throw new AdminError("প্রশ্নটি পাওয়া যায়নি।", 404);
  const other = claimedByOther(doc, actor, new Date());
  if (other) {
    throw new AdminError(
      `${other.category} ${other.name} এখন প্রশ্নটি দেখছেন। তিনি ছেড়ে দিলে বা সময় শেষ হলে আবার চেষ্টা করুন।`,
      409,
    );
  }
  throw new AdminError("প্রশ্নটির অবস্থা এর মধ্যে বদলে গেছে। পাতাটি হালনাগাদ করে আবার দেখুন।", 409);
}

function claimableBy(actor: HelpActor, now: Date): Filter<HelpRequestDoc> {
  if (actor.role === "admin") return {};
  return {
    $or: [
      { claim: { $exists: false } },
      { "claim.expiresAt": { $lte: now } },
      { "claim.principalId": actor.principalId },
    ],
  };
}

function requireHandle(actor: HelpActor): void {
  if (!actor.canHandle) throw new AdminError("এই কাজের অনুমতি আপনার নেই।", 403);
}

function requireAdmin(actor: HelpActor): void {
  if (actor.role !== "admin") throw new AdminError("শুধু অ্যাডমিন এটি করতে পারেন।", 403);
}

async function updateOrConflict(
  id: ObjectId,
  filter: Filter<HelpRequestDoc>,
  update: UpdateFilter<HelpRequestDoc>,
  actor: HelpActor,
): Promise<HelpRequestDoc> {
  const store = await requests();
  const updated = await store.findOneAndUpdate({ $and: [{ _id: id }, filter] }, update, {
    returnDocument: "after",
  });
  if (updated) return updated;
  return conflict(await store.findOne({ _id: id }), actor);
}

export async function claimHelpRequest(actor: HelpActor, id: string): Promise<HelpRequestDoc> {
  requireHandle(actor);
  const now = new Date();
  const _id = parseId(id);
  return updateOrConflict(
    _id,
    { $and: [{ status: "open" }, claimableBy(actor, now)] },
    {
      $set: {
        claim: {
          principalId: actor.principalId,
          name: actor.name,
          category: actor.categoryName,
          email: actor.email,
          at: now,
          expiresAt: new Date(now.getTime() + HELP_CONFIG.claimMinutes * 60_000),
        },
        updatedAt: now,
      },
    },
    actor,
  );
}

export async function releaseHelpRequest(actor: HelpActor, id: string): Promise<HelpRequestDoc> {
  requireHandle(actor);
  const _id = parseId(id);
  return updateOrConflict(
    _id,
    actor.role === "admin"
      ? { status: "open" }
      : { status: "open", "claim.principalId": actor.principalId },
    { $unset: { claim: "" }, $set: { updatedAt: new Date() } },
    actor,
  );
}

export async function listHelpAssignees(): Promise<HelpAssignee[]> {
  const [staff, admins] = await Promise.all([
    listStaff({ status: "active", limit: 500 }),
    Promise.all(ADMIN_CONFIG.accounts.map((email) => resolvePrincipal(email))),
  ]);
  return [
    ...staff.items
      .filter((item) => item.role === "scholar")
      .map((item) => ({ id: item.id, name: item.name, category: item.categoryName })),
    ...admins.flatMap((principal) =>
      principal
        ? [{ id: principal.principalId, name: principal.name, category: principal.categoryName }]
        : [],
    ),
  ];
}

async function assigneeRef(assigneeId: string): Promise<HelpActorRef> {
  if (assigneeId.includes("@")) {
    const principal = await resolvePrincipal(assigneeId);
    if (principal?.role === "admin") {
      return {
        id: principal.principalId,
        name: principal.name,
        category: principal.categoryName,
        email: principal.email,
      };
    }
    throw new AdminError("এই ব্যক্তিকে প্রশ্ন দেওয়া যাবে না।", 422);
  }
  const staff = await getStaff(assigneeId);
  if (staff.role !== "scholar" || staff.status !== "active") {
    throw new AdminError("শুধু সক্রিয় আলেমদের প্রশ্ন দেওয়া যায়।", 422);
  }
  return { id: staff.id, name: staff.name, category: staff.categoryName, email: staff.email };
}

export async function reassignHelpRequest(
  actor: HelpActor,
  id: string,
  assigneeId: string,
): Promise<{ doc: HelpRequestDoc; assignee: HelpActorRef }> {
  requireAdmin(actor);
  const _id = parseId(id);
  const assignee = await assigneeRef(assigneeId);
  const now = new Date();
  const doc = await updateOrConflict(
    _id,
    { status: "open" },
    {
      $set: {
        claim: {
          principalId: assignee.id,
          name: assignee.name,
          category: assignee.category,
          email: assignee.email,
          at: now,
          expiresAt: new Date(now.getTime() + HELP_CONFIG.claimMinutes * 60_000),
        },
        updatedAt: now,
      },
    },
    actor,
  );
  return { doc, assignee };
}

export async function answerHelpRequest(
  actor: HelpActor,
  id: string,
  input: HelpAnswerInput,
): Promise<{ doc: HelpRequestDoc; warning: string | null; edited: boolean }> {
  requireHandle(actor);
  const _id = parseId(id);
  const before = await loadDoc(id);
  const now = new Date();
  const editing = before.status === "answered";
  if (editing) requireAdmin(actor);
  if (before.status === "closed") conflict(before, actor);
  if (!editing && actor.role !== "admin" && claimedByOther(before, actor, now)) {
    conflict(before, actor);
  }

  const { sources, checks } = await resolveSources(input.sources);
  const missing = checks.filter((check) => !check.found).map((check) => check.reference);
  if (missing.length > 0) {
    throw new AdminError(
      `এই রেফারেন্সগুলো দলিল ভান্ডারে পাওয়া যায়নি: ${missing.join(", ")}`,
      422,
    );
  }

  const answeredBy = editing && before.answeredBy ? before.answeredBy : actorRef(actor);
  const statusFilter: Filter<HelpRequestDoc> = editing
    ? { status: "answered" }
    : { $and: [{ status: "open" }, claimableBy(actor, now)] };

  let doc = await updateOrConflict(
    _id,
    statusFilter,
    {
      $set: {
        status: "answered",
        answer: input.answer,
        sources,
        answeredBy,
        answeredAt: editing && before.answeredAt ? before.answeredAt : now,
        updatedAt: now,
        expiresAt: retentionDate(now, HELP_CONFIG.answeredRetentionDays),
      },
      $unset: {
        claim: "",
        closedReason: "",
        closedNote: "",
        closedAt: "",
        closedBy: "",
      },
    },
    actor,
  );

  let warning: string | null = null;
  if (input.publish || doc.masalaId) {
    try {
      const masalaId = await saveScholarAnswer({
        ...(doc.masalaId ? { id: doc.masalaId } : {}),
        question: input.masalaQuestion ?? doc.question,
        answer: input.answer,
        sources,
        author: { id: answeredBy.id, name: answeredBy.name, category: answeredBy.category },
        published: input.publish,
        actor: actor.email,
      });
      doc =
        (await (
          await requests()
        ).findOneAndUpdate(
          { _id },
          { $set: { masalaId, published: input.publish } },
          { returnDocument: "after" },
        )) ?? doc;
    } catch (error) {
      logger.warn("Publishing a help answer as a masala failed", {
        error: String(error).slice(0, 160),
      });
      warning =
        "উত্তর পাঠানো হয়েছে, কিন্তু মাসআলা হিসেবে প্রকাশ করা যায়নি। পরে আবার চেষ্টা করুন।";
    }
  }

  if (!editing && doc.email) {
    const notification = await notifyHelpAnswered(doc);
    doc =
      (await (
        await requests()
      ).findOneAndUpdate({ _id }, { $set: { notification } }, { returnDocument: "after" })) ?? doc;
  }

  return { doc, warning, edited: editing };
}

export async function closeHelpRequest(
  actor: HelpActor,
  id: string,
  input: { reason: HelpCloseReason; note?: string },
): Promise<HelpRequestDoc> {
  requireHandle(actor);
  const _id = parseId(id);
  const now = new Date();
  const filter: Filter<HelpRequestDoc> =
    actor.role === "admin"
      ? { status: { $in: ["open", "answered"] } }
      : { $and: [{ status: "open" }, claimableBy(actor, now)] };

  return updateOrConflict(
    _id,
    filter,
    {
      $set: {
        status: "closed",
        closedReason: input.reason,
        closedAt: now,
        closedBy: actorRef(actor),
        updatedAt: now,
        expiresAt: retentionDate(now, HELP_CONFIG.answeredRetentionDays),
        ...(input.note ? { closedNote: input.note } : {}),
      },
      $unset: { claim: "", ...(input.note ? {} : { closedNote: "" }) },
    },
    actor,
  );
}

export async function reopenHelpRequest(actor: HelpActor, id: string): Promise<HelpRequestDoc> {
  requireAdmin(actor);
  const _id = parseId(id);
  const now = new Date();
  return updateOrConflict(
    _id,
    { status: { $in: ["answered", "closed"] } },
    {
      $set: {
        status: "open",
        updatedAt: now,
        expiresAt: retentionDate(now, HELP_CONFIG.openRetentionDays),
      },
      $unset: { claim: "", closedReason: "", closedNote: "", closedAt: "", closedBy: "" },
    },
    actor,
  );
}

export async function deleteHelpRequest(actor: HelpActor, id: string): Promise<HelpRequestDoc> {
  requireAdmin(actor);
  const removed = await (await requests()).findOneAndDelete({ _id: parseId(id) });
  if (!removed) throw new AdminError("প্রশ্নটি পাওয়া যায়নি।", 404);
  return removed;
}

export async function helpActionResponse(
  doc: HelpRequestDoc,
  actor: HelpActor,
  warning: string | null = null,
): Promise<HelpActionResponse> {
  return { detail: await toHelpDetail(doc, actor), warning };
}
