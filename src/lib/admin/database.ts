import { formatTimestamp } from "@/lib/utils/dateTime";
import { createHash } from "node:crypto";
import {
  BSON,
  Binary,
  Long,
  MongoServerError,
  type Db,
  type Document,
  type Filter,
  type Sort,
} from "mongodb";
import { ADMIN_CONFIG, DB_CONFIG } from "@/config/site";
import { AdminError } from "@/lib/admin/http";
import { getDb } from "@/lib/db/mongoClient";
import { storageUsage } from "@/lib/maintenance/storage";

const { EJSON } = BSON;

export const DATABASE_BROWSER_LIMITS = {
  maxFilterChars: 20_000,
  maxIdChars: 1_024,
  maxFilterDepth: 20,
  maxDocumentDepth: 100,
  maxPage: 50_000,
  countLimit: 10_000,
  queryTimeMs: 15_000,
  summaryFields: 4,
  summaryChars: 80,
  maxBsonBytes: 16 * 1024 * 1024,
} as const;

export const COLLECTION_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,120}$/;
const SORT_FIELD_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,199}$/;
const LOGICAL_OPERATORS = new Set(["$and", "$or", "$nor"]);
const FORBIDDEN_OPERATORS = new Set(["$where", "$function", "$accumulator"]);
export const BINARY_REF_KEY = "$binaryRef";

export const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  [DB_CONFIG.collection]:
    "দলিল ভান্ডার: কুরআন, হাদিস, ইজমা, কিয়াস, সীরাত ও ফিকহের প্রতিটি অংশ, সাইটেশন ও embedding",
  [DB_CONFIG.queryLogCollection]: "প্রতিটি প্রশ্নের লগ: ভাষা, উৎস, স্কোর ও উত্তরের অবস্থা",
  [DB_CONFIG.feedbackCollection]: "ব্যবহারকারীদের মতামত ও রিভিউয়ের সারি",
  [DB_CONFIG.feedbackTallyCollection]: "মতামতের সংক্ষিপ্ত হিসাব",
  [DB_CONFIG.verifiedAnswerCollection]: "যাচাইকৃত উত্তর, যা মডেল ছাড়াই সরাসরি দেখানো হয়",
  [DB_CONFIG.rankingSignalCollection]:
    "মতামত থেকে শেখা র‍্যাঙ্কিং সংকেত, বিষয় ও রেফারেন্স অনুযায়ী",
  [DB_CONFIG.queryEmbeddingCollection]:
    "প্রশ্নের embedding ক্যাশ, যাতে একই প্রশ্নে কোটা খরচ না হয়",
  [DB_CONFIG.quranNotesCollection]:
    "ড. আবু বকর যাকারিয়ার অনুবাদ ও টীকা, প্রতি সূরার জন্য একটি সংকুচিত Binary",
  [DB_CONFIG.queryInsightsCollection]: "পুরোনো প্রশ্ন লগের সারাংশ, প্রতি প্রশ্নে একটি",
  [DB_CONFIG.corpusSourcesCollection]: "প্রতিটি উৎসের প্রোভাইডার ও ইনজেশনের তথ্য",
  [DB_CONFIG.maintenanceCollection]: "রক্ষণাবেক্ষণ কাজের অবস্থা ও ওয়াটারমার্ক",
  [DB_CONFIG.rateLimitCollection]: "অনুরোধের সীমার কাউন্টার, ক্লায়েন্ট হ্যাশ করা অবস্থায়",
  [DB_CONFIG.sourceTranslationCollection]: "কিতাবের অনুচ্ছেদের AI অনুবাদের ক্যাশ",
  [DB_CONFIG.learningCollection]: "শেখা রিরাইট, রিরাঙ্ক রায় ও মডেলের ফলাফল",
  [DB_CONFIG.adminAuditCollection]: "অ্যাডমিনদের প্রতিটি কাজের অডিট লগ",
  [DB_CONFIG.siteContentCollection]: "সাইট ও AI সেটিংসের সম্পাদনযোগ্য কনটেন্ট",
};

const GUARDED_COLLECTIONS: ReadonlySet<string> = new Set([
  DB_CONFIG.collection,
  DB_CONFIG.quranNotesCollection,
  DB_CONFIG.verifiedAnswerCollection,
]);

export function isGuardedCollection(name: string): boolean {
  return GUARDED_COLLECTIONS.has(name);
}

export function isProtectedCollection(name: string): boolean {
  return (
    name.startsWith("system.") ||
    (ADMIN_CONFIG.protectedCollections as readonly string[]).includes(name)
  );
}

export function assertCollectionName(name: string): string {
  if (!COLLECTION_NAME_PATTERN.test(name)) {
    throw new AdminError("কালেকশনের নাম সঠিক নয়।", 400);
  }
  if (isProtectedCollection(name)) {
    throw new AdminError("এই কালেকশন ডাটাবেস ব্রাউজার থেকে দেখা বা বদলানো যায় না।", 403);
  }
  return name;
}

function isBsonValue(value: unknown): boolean {
  return typeof value === "object" && value !== null && "_bsontype" in value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !isBsonValue(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function parseEjson(text: string, what: string): unknown {
  try {
    return EJSON.parse(text, { relaxed: false });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AdminError(`${what} সঠিক Extended JSON নয়: ${reason.slice(0, 200)}`, 400);
  }
}

function validateOperand(value: unknown, depth: number): void {
  if (depth > DATABASE_BROWSER_LIMITS.maxFilterDepth) {
    throw new AdminError("ফিল্টার অনেক বেশি গভীর।", 400);
  }
  if (Array.isArray(value)) {
    for (const item of value) validateOperand(item, depth + 1);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, inner] of Object.entries(value)) {
    if (FORBIDDEN_OPERATORS.has(key)) {
      throw new AdminError(`ফিল্টারে ${key} ব্যবহার করা যাবে না।`, 400);
    }
    validateOperand(inner, depth + 1);
  }
}

function validateQueryObject(query: Record<string, unknown>, depth: number): void {
  if (depth > DATABASE_BROWSER_LIMITS.maxFilterDepth) {
    throw new AdminError("ফিল্টার অনেক বেশি গভীর।", 400);
  }
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith("$")) {
      if (!LOGICAL_OPERATORS.has(key)) {
        throw new AdminError(
          `ফিল্টারের উপরের স্তরে শুধু $and, $or ও $nor চলে, ${key} চলবে না।`,
          400,
        );
      }
      if (!Array.isArray(value) || value.length === 0 || !value.every(isPlainObject)) {
        throw new AdminError(`${key} এর মান অবজেক্টের একটি অ-খালি array হতে হবে।`, 400);
      }
      for (const item of value) validateQueryObject(item, depth + 1);
      continue;
    }
    validateOperand(value, depth + 1);
  }
}

export function validateFilter(value: unknown): Filter<Document> {
  if (!isPlainObject(value)) {
    throw new AdminError("ফিল্টার একটি JSON অবজেক্ট হতে হবে, যেমন {}।", 400);
  }
  validateQueryObject(value, 0);
  return value;
}

export function parseFilterText(text: string | null | undefined): Filter<Document> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return {};
  if (trimmed.length > DATABASE_BROWSER_LIMITS.maxFilterChars) {
    throw new AdminError("ফিল্টার অনেক বড়।", 400);
  }
  return validateFilter(parseEjson(trimmed, "ফিল্টার"));
}

export function isEmptyFilter(filter: Filter<Document>): boolean {
  return Object.keys(filter).length === 0;
}

export function parseSort(field: string | null | undefined, direction: string | null): Sort {
  const order = direction === "asc" ? 1 : -1;
  const name = field?.trim() || "_id";
  if (!SORT_FIELD_PATTERN.test(name)) {
    throw new AdminError("সাজানোর ফিল্ডের নাম সঠিক নয়।", 400);
  }
  return name === "_id" ? { _id: order } : { [name]: order, _id: order };
}

export function parsePage(value: string | null): number {
  const page = Number(value ?? "1");
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, DATABASE_BROWSER_LIMITS.maxPage);
}

export function parseOffset(
  value: string | null,
  pageSize: number = ADMIN_CONFIG.databasePageSize,
): number {
  const offset = Number(value ?? "0");
  if (!Number.isInteger(offset) || offset < 0) return 0;
  return Math.min(offset, (DATABASE_BROWSER_LIMITS.maxPage - 1) * pageSize);
}

function encodePointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function decodePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) {
    throw new AdminError(`Binary রেফারেন্স "${pointer.slice(0, 80)}" সঠিক নয়।`, 400);
  }
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

export function valueAtPointer(root: unknown, pointer: string): unknown {
  let current: unknown = root;
  for (const segment of decodePointer(pointer)) {
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) return undefined;
      current = current[Number(segment)];
    } else if (isPlainObject(current)) {
      current = Object.prototype.hasOwnProperty.call(current, segment)
        ? current[segment]
        : undefined;
    } else {
      return undefined;
    }
  }
  return current;
}

export interface BinarySummary {
  path: string;
  subtype: number;
  bytes: number;
}

export interface BinaryPlaceholder {
  [BINARY_REF_KEY]: string;
  subtype: number;
  bytes: number;
}

export function toEditableValue(
  value: unknown,
  binaries: BinarySummary[] = [],
  path = "",
): unknown {
  if (value instanceof Binary) {
    const summary = { path, subtype: value.sub_type, bytes: value.length() };
    binaries.push(summary);
    return { [BINARY_REF_KEY]: path, subtype: summary.subtype, bytes: summary.bytes };
  }
  if (Long.isLong(value)) return { $numberLong: value.toString() };
  if (typeof value === "bigint") return { $numberLong: value.toString() };
  if (Array.isArray(value)) {
    return value.map((item, index) => toEditableValue(item, binaries, `${path}/${index}`));
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      result[key] = toEditableValue(inner, binaries, `${path}/${encodePointerSegment(key)}`);
    }
    return result;
  }
  return value;
}

export function isBinaryPlaceholder(value: unknown): value is BinaryPlaceholder {
  return isPlainObject(value) && typeof value[BINARY_REF_KEY] === "string";
}

export function restoreBinaries(value: unknown, original: unknown | null): unknown {
  if (isBinaryPlaceholder(value)) {
    const pointer = value[BINARY_REF_KEY];
    if (original === null) {
      throw new AdminError("নতুন নথিতে $binaryRef ব্যবহার করা যায় না।", 400);
    }
    const source = valueAtPointer(original, pointer);
    if (!(source instanceof Binary)) {
      throw new AdminError(`মূল নথিতে "${pointer.slice(0, 120)}" পথে কোনো Binary নেই।`, 400);
    }
    return source;
  }
  if (Array.isArray(value)) return value.map((item) => restoreBinaries(item, original));
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      result[key] = restoreBinaries(inner, original);
    }
    return result;
  }
  return value;
}

export function assertStorableKeys(value: unknown, depth = 0): void {
  if (depth > DATABASE_BROWSER_LIMITS.maxDocumentDepth) {
    throw new AdminError("নথি অনেক বেশি গভীর।", 400);
  }
  if (Array.isArray(value)) {
    for (const item of value) assertStorableKeys(item, depth + 1);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, inner] of Object.entries(value)) {
    if (key.startsWith("$")) {
      throw new AdminError(`নথির ফিল্ডের নাম $ দিয়ে শুরু হতে পারে না: ${key.slice(0, 60)}`, 400);
    }
    if (key.includes(" ")) {
      throw new AdminError("নথির ফিল্ডের নামে NUL অক্ষর থাকতে পারে না।", 400);
    }
    assertStorableKeys(inner, depth + 1);
  }
}

export function parseDocumentText(text: string, original: Document | null): Document {
  if (Buffer.byteLength(text, "utf8") > ADMIN_CONFIG.maxJsonDocumentBytes) {
    throw new AdminError("নথিটি অনুমোদিত আকারের চেয়ে বড়।", 413);
  }
  const parsed = parseEjson(text, "নথি");
  if (!isPlainObject(parsed)) {
    throw new AdminError("নথি একটি JSON অবজেক্ট হতে হবে, array বা একক মান নয়।", 400);
  }
  const restored = restoreBinaries(parsed, original) as Document;
  assertStorableKeys(restored);
  if (BSON.calculateObjectSize(restored) > DATABASE_BROWSER_LIMITS.maxBsonBytes) {
    throw new AdminError("নথিটি MongoDB এর ১৬ MB সীমা ছাড়িয়ে যায়।", 413);
  }
  return restored;
}

export function idToText(id: unknown): string {
  return EJSON.stringify(toEditableValue(id), { relaxed: true });
}

export function parseIdText(text: string | null | undefined): unknown {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) throw new AdminError("নথির id দেওয়া হয়নি।", 400);
  if (trimmed.length > DATABASE_BROWSER_LIMITS.maxIdChars) {
    throw new AdminError("নথির id অনেক বড়।", 400);
  }
  const value = parseEjson(trimmed, "নথির id");
  if (value === null || value === undefined || Array.isArray(value)) {
    throw new AdminError("নথির id হিসেবে এই মান চলবে না।", 400);
  }
  if (isPlainObject(value)) {
    if (isBinaryPlaceholder(value)) throw new AdminError("নথির id সঠিক নয়।", 400);
    assertStorableKeys(value);
  }
  return value;
}

export function canonicalText(value: unknown): string {
  return EJSON.stringify(value, { relaxed: false });
}

export function sameId(a: unknown, b: unknown): boolean {
  return canonicalText(a) === canonicalText(b);
}

export function documentRevision(doc: Document): string {
  return createHash("sha256").update(canonicalText(doc)).digest("hex").slice(0, 32);
}

export function changedTopLevelKeys(before: Document, after: Document): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter(
    (key) =>
      key !== "_id" &&
      (!(key in before) ||
        !(key in after) ||
        canonicalText(before[key]) !== canonicalText(after[key])),
  );
}

export interface SummaryField {
  key: string;
  value: string;
}

export interface RowSummary {
  id: string;
  fields: SummaryField[];
  bytes: number;
  binaries: number;
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(collapsed);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : collapsed;
}

function scalarPreview(value: unknown): string | undefined {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) {
    return formatTimestamp(value) ?? "Invalid Date";
  }
  if (isBsonValue(value)) {
    const type = (value as { _bsontype: string })._bsontype;
    if (type === "ObjectId") return `ObjectId(${String(value)})`;
    if (["Long", "Int32", "Double", "Decimal128", "Timestamp"].includes(type)) {
      return String(value);
    }
  }
  return undefined;
}

export function summarizeDocument(
  doc: Document,
  maxFields: number = DATABASE_BROWSER_LIMITS.summaryFields,
  maxChars: number = DATABASE_BROWSER_LIMITS.summaryChars,
): RowSummary {
  const fields: SummaryField[] = [];
  let binaries = 0;

  const visit = (value: unknown, key: string, depth: number) => {
    if (value instanceof Binary) {
      binaries += 1;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) if (item instanceof Binary) binaries += 1;
      return;
    }
    if (isPlainObject(value)) {
      if (depth >= 3) return;
      for (const [inner, innerValue] of Object.entries(value)) {
        visit(innerValue, `${key}.${inner}`, depth + 1);
      }
      return;
    }
    const preview = scalarPreview(value);
    if (preview !== undefined && fields.length < maxFields) {
      fields.push({ key, value: truncate(preview, maxChars) });
    }
  };

  for (const [key, value] of Object.entries(doc)) {
    if (key !== "_id") visit(value, key, 1);
  }

  return {
    id: idToText(doc._id),
    fields,
    bytes: BSON.calculateObjectSize(doc),
    binaries,
  };
}

export function mongoFailure(error: unknown): unknown {
  if (error instanceof AdminError) return error;
  if (error instanceof MongoServerError) {
    const code = Number(error.code);
    if (code === 11000) return new AdminError("একই _id বা ইউনিক কী আগেই আছে।", 409);
    if (code === 50) {
      return new AdminError("কোয়েরি সময়সীমা পেরিয়ে গেছে। ফিল্টার আরও নির্দিষ্ট করুন।", 408);
    }
    if (code === 8000) {
      return new AdminError("Atlas স্টোরেজ কোটা পূর্ণ, লেখা যায়নি।", 507);
    }
    return new AdminError(`MongoDB অনুরোধটি গ্রহণ করেনি: ${error.message.slice(0, 200)}`, 400);
  }
  return error;
}

async function withMongo<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw mongoFailure(error);
  }
}

async function openCollection(name: string, write: boolean) {
  assertCollectionName(name);
  const db: Db = await getDb();
  const [info] = await db.listCollections({ name }).toArray();
  if (!info) throw new AdminError("কালেকশনটি পাওয়া যায়নি।", 404);
  if (write && info.type !== "collection") {
    throw new AdminError("এটি একটি view, এখানে লেখা যায় না।", 400);
  }
  return db.collection(name);
}

const READ_OPTIONS = { promoteLongs: false } as const;

export async function listCollectionsOverview() {
  const usage = await storageUsage();
  return {
    usage: {
      usedBytes: usage.usedBytes,
      quotaBytes: usage.quotaBytes,
      dataBytes: usage.dataBytes,
      indexBytes: usage.indexBytes,
      ratio: usage.ratio,
    },
    collections: usage.collections
      .filter(
        (collection) =>
          COLLECTION_NAME_PATTERN.test(collection.name) && !isProtectedCollection(collection.name),
      )
      .map((collection) => ({
        name: collection.name,
        description: COLLECTION_DESCRIPTIONS[collection.name] ?? null,
        count: collection.count,
        dataBytes: collection.dataBytes,
        indexBytes: collection.indexBytes,
      })),
  };
}

export async function listDocuments(
  name: string,
  options: {
    filterText: string | null;
    sortField: string | null;
    direction: string | null;
    page: number;
    offset?: number | null;
  },
) {
  const filter = parseFilterText(options.filterText);
  const sort = parseSort(options.sortField, options.direction);
  const collection = await openCollection(name, false);
  const pageSize = ADMIN_CONFIG.databasePageSize;
  const limits = DATABASE_BROWSER_LIMITS;
  const skip = options.offset ?? (options.page - 1) * pageSize;

  const countPromise =
    skip === 0
      ? (isEmptyFilter(filter)
          ? collection.estimatedDocumentCount({ maxTimeMS: limits.queryTimeMs })
          : collection.countDocuments(filter, {
              limit: limits.countLimit,
              maxTimeMS: limits.queryTimeMs,
            })
        ).catch(() => null)
      : Promise.resolve(null);

  const rows = await withMongo(() =>
    collection
      .find(filter, {
        ...READ_OPTIONS,
        sort,
        skip,
        limit: pageSize + 1,
        maxTimeMS: limits.queryTimeMs,
      })
      .toArray(),
  );
  const total = await countPromise;

  return {
    collection: name,
    description: COLLECTION_DESCRIPTIONS[name] ?? null,
    page: options.page,
    offset: skip,
    pageSize,
    hasNext: rows.length > pageSize,
    counted: skip === 0,
    total,
    totalCapped: !isEmptyFilter(filter) && total !== null && total >= limits.countLimit,
    emptyFilter: isEmptyFilter(filter),
    rows: rows.slice(0, pageSize).map((row) => summarizeDocument(row)),
  };
}

export function documentView(doc: Document) {
  const binaries: BinarySummary[] = [];
  const editable = toEditableValue(doc, binaries);
  return {
    id: idToText(doc._id),
    text: EJSON.stringify(editable, null, 2, { relaxed: true }),
    binaries,
    bytes: BSON.calculateObjectSize(doc),
    revision: documentRevision(doc),
  };
}

async function findOriginal(name: string, idText: string | null, write: boolean) {
  const id = parseIdText(idText);
  const collection = await openCollection(name, write);
  const original = await withMongo(() =>
    collection.findOne({ _id: id } as Filter<Document>, READ_OPTIONS),
  );
  if (!original) throw new AdminError("নথিটি পাওয়া যায়নি।", 404);
  return { collection, original };
}

export async function readDocument(name: string, idText: string | null) {
  const { original } = await findOriginal(name, idText, false);
  return documentView(original);
}

export async function readRowSummary(name: string, idText: string | null) {
  const id = parseIdText(idText);
  const collection = await openCollection(name, false);
  const doc = await withMongo(() =>
    collection.findOne({ _id: id } as Filter<Document>, READ_OPTIONS),
  );
  return doc ? summarizeDocument(doc) : null;
}

export async function insertDocument(name: string, text: string) {
  const collection = await openCollection(name, true);
  const doc = parseDocumentText(text, null);
  const result = await withMongo(() => collection.insertOne(doc));
  const inserted = await collection.findOne({ _id: result.insertedId }, READ_OPTIONS);
  return {
    id: idToText(result.insertedId),
    bytes: inserted ? BSON.calculateObjectSize(inserted) : BSON.calculateObjectSize(doc),
  };
}

export async function replaceDocument(
  name: string,
  idText: string | null,
  text: string,
  revision: string,
) {
  const { collection, original } = await findOriginal(name, idText, true);
  if (documentRevision(original) !== revision) {
    throw new AdminError(
      "খোলার পর নথিটি অন্য কোথাও বদলেছে। আবার খুলে সর্বশেষ সংস্করণে সম্পাদনা করুন।",
      409,
    );
  }
  const next = parseDocumentText(text, original);
  if ("_id" in next && !sameId(next._id, original._id)) {
    throw new AdminError("_id বদলানো যায় না। নতুন _id লাগলে নতুন নথি তৈরি করুন।", 400);
  }
  const replacement: Document = { ...next };
  delete replacement._id;

  const changed = changedTopLevelKeys(original, replacement);
  const result = await withMongo(() =>
    collection.replaceOne({ _id: original._id } as Filter<Document>, replacement),
  );
  if (result.matchedCount === 0) throw new AdminError("নথিটি পাওয়া যায়নি।", 404);

  const updated = await collection.findOne({ _id: original._id } as Filter<Document>, READ_OPTIONS);
  return { view: updated ? documentView(updated) : null, changed };
}

export async function deleteDocument(name: string, idText: string | null) {
  const { collection, original } = await findOriginal(name, idText, true);
  const result = await withMongo(() =>
    collection.deleteOne({ _id: original._id } as Filter<Document>),
  );
  if (result.deletedCount === 0) throw new AdminError("নথিটি পাওয়া যায়নি।", 404);
  return { id: idToText(original._id), bytes: BSON.calculateObjectSize(original) };
}

export function assertBulkDeleteAllowed(
  name: string,
  filter: Filter<Document>,
  confirmName: string,
  confirmAll: boolean,
): void {
  if (confirmName !== name) {
    throw new AdminError("নিশ্চিত করতে কালেকশনের নাম হুবহু লিখুন।", 400);
  }
  if (isEmptyFilter(filter) && !confirmAll) {
    throw new AdminError(
      isGuardedCollection(name)
        ? "খালি ফিল্টারে এই গুরুত্বপূর্ণ কালেকশনের সব নথি মুছে যাবে। সব মুছতে চাইলে আলাদাভাবে নিশ্চিত করুন।"
        : "খালি ফিল্টারে কালেকশনের সব নথি মুছে যাবে। সব মুছতে চাইলে আলাদাভাবে নিশ্চিত করুন।",
      400,
    );
  }
}

export async function bulkDelete(
  name: string,
  options: { filterText: string; confirmName: string; confirmAll: boolean },
) {
  const filter = parseFilterText(options.filterText);
  assertBulkDeleteAllowed(name, filter, options.confirmName, options.confirmAll);
  const collection = await openCollection(name, true);
  const result = await withMongo(() =>
    collection.deleteMany(filter, { maxTimeMS: DATABASE_BROWSER_LIMITS.queryTimeMs * 4 }),
  );
  return { deletedCount: result.deletedCount, emptyFilter: isEmptyFilter(filter) };
}
