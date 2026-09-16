import { randomBytes, randomInt } from "node:crypto";
import { MongoServerError, ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { ADMIN_CONFIG, DB_CONFIG, EMAIL_CONFIG, STAFF_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { isAdminEmail, normalizeEmail } from "@/lib/admin/identity";
import { AdminError } from "@/lib/admin/errors";
import { hashPassword } from "@/lib/admin/password";
import type { StaffRole } from "@/lib/admin/roles";
import { deleteResetTokensByEmail, deleteSessionsByEmail } from "@/lib/admin/sessionStore";
import { sendRenderedEmail, senderAddress } from "@/lib/email/mailer";
import { staffAccountEmail, type StaffEmailKind } from "@/lib/email/templates/staffAccount";
import { loadSiteDomain } from "@/lib/site/domain";
import { logger } from "@/lib/utils/logger";

export type StaffStatus = "active" | "suspended";

export interface StaffCategory {
  _id: string;
  name: string;
  role: StaffRole;
  description?: string;
  order: number;
  system: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

export interface StaffAccount {
  _id: ObjectId;
  email: string;
  name: string;
  phone?: string;
  categoryId: string;
  passwordHash: string;
  mustChangePassword: boolean;
  status: StaffStatus;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface CategoryView {
  id: string;
  name: string;
  role: StaffRole;
  description: string;
  order: number;
  system: boolean;
  accounts: number;
  updatedAt: string;
}

export interface StaffView {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  categoryId: string;
  categoryName: string;
  role: StaffRole | null;
  status: StaffStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

const SEED_MARKER = "staff-categories-seeded";
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%+=?";

export const CATEGORY_DESCRIPTION_CHARS = 300;
export const STAFF_ROLES = ["moderator", "scholar"] as const satisfies readonly StaffRole[];
export const STAFF_STATUSES = ["active", "suspended"] as const satisfies readonly StaffStatus[];

const PHONE_PATTERN = /^[0-9০-৯+() -]*$/;

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "ইমেইল দিন।")
  .max(254, "ইমেইল অনেক লম্বা।")
  .pipe(z.email("ইমেইল ঠিকানাটি সঠিক নয়।"));

const nameField = z
  .string()
  .trim()
  .min(1, "নাম দিন।")
  .max(STAFF_CONFIG.maxNameChars, `নাম ${STAFF_CONFIG.maxNameChars} অক্ষরের বেশি হতে পারবে না।`);

const phoneField = z
  .string()
  .trim()
  .max(
    STAFF_CONFIG.maxPhoneChars,
    `ফোন নম্বর ${STAFF_CONFIG.maxPhoneChars} অক্ষরের বেশি হতে পারবে না।`,
  )
  .regex(PHONE_PATTERN, "ফোন নম্বরে শুধু সংখ্যা, স্পেস, +, - ও () দেওয়া যাবে।");

const passwordField = z
  .string()
  .min(
    ADMIN_CONFIG.minPasswordChars,
    `পাসওয়ার্ড অন্তত ${ADMIN_CONFIG.minPasswordChars} অক্ষরের হতে হবে।`,
  )
  .max(
    ADMIN_CONFIG.maxPasswordChars,
    `পাসওয়ার্ড ${ADMIN_CONFIG.maxPasswordChars} অক্ষরের বেশি হতে পারবে না।`,
  );

const categoryIdField = z.string().trim().min(1, "ক্যাটাগরি বেছে নিন।").max(64);

export const staffCreateInput = z.object({
  categoryId: categoryIdField,
  name: nameField,
  email: emailField,
  phone: phoneField.optional(),
  password: passwordField,
});

export const staffUpdateInput = z
  .object({
    categoryId: categoryIdField.optional(),
    name: nameField.optional(),
    email: emailField.optional(),
    phone: phoneField.nullable().optional(),
    status: z.enum(STAFF_STATUSES).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "কিছুই পরিবর্তন করা হয়নি।",
  });

export const staffPasswordInput = z.object({ password: passwordField });

export const profileInput = z.object({
  name: nameField,
  phone: phoneField.nullable().optional(),
});

export type ProfileInput = z.infer<typeof profileInput>;

export async function updateOwnStaffProfile(email: string, input: ProfileInput): Promise<void> {
  const phone = input.phone?.trim();
  await (
    await accountCollection()
  ).updateOne(
    { email: normalizeEmail(email) },
    {
      $set: {
        name: input.name.replace(/\s+/g, " ").trim(),
        ...(phone ? { phone } : {}),
        updatedAt: new Date(),
        updatedBy: normalizeEmail(email),
      },
      ...(phone ? {} : { $unset: { phone: "" } }),
    },
  );
}

const categoryNameField = z
  .string()
  .trim()
  .min(1, "ক্যাটাগরির নাম দিন।")
  .max(
    STAFF_CONFIG.maxCategoryNameChars,
    `নাম ${STAFF_CONFIG.maxCategoryNameChars} অক্ষরের বেশি হতে পারবে না।`,
  );

const descriptionField = z
  .string()
  .trim()
  .max(
    CATEGORY_DESCRIPTION_CHARS,
    `বিবরণ ${CATEGORY_DESCRIPTION_CHARS} অক্ষরের বেশি হতে পারবে না।`,
  );

export const categoryCreateInput = z.object({
  name: categoryNameField,
  role: z.enum(STAFF_ROLES),
  description: descriptionField.default(""),
});

export const categoryUpdateInput = z
  .object({
    name: categoryNameField.optional(),
    role: z.enum(STAFF_ROLES).optional(),
    description: descriptionField.optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "কিছুই পরিবর্তন করা হয়নি।",
  });

export const categoryOrderInput = z.object({
  ids: z.array(categoryIdField).min(1).max(500),
});

let categoryCache: { loadedAt: number; categories: Map<string, StaffCategory> } | null = null;

async function categoryCollection() {
  return (await getDb()).collection<StaffCategory>(DB_CONFIG.staffCategoryCollection);
}

async function accountCollection() {
  return (await getDb()).collection<StaffAccount>(DB_CONFIG.staffAccountCollection);
}

export function invalidateCategories(): void {
  categoryCache = null;
}

export function generatePassword(length: number = STAFF_CONFIG.generatedPasswordChars): string {
  let password = "";
  while (password.length < length) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

export async function ensureStaffIndexes(): Promise<void> {
  const accounts = await accountCollection();
  await accounts.createIndex({ email: 1 }, { unique: true, name: "staff_email_unique" });
  await accounts.createIndex({ categoryId: 1 });
}

export async function ensureDefaultCategories(): Promise<void> {
  const db = await getDb();
  const state = db.collection<{ _id: string; at: Date }>(DB_CONFIG.maintenanceCollection);
  if (await state.findOne({ _id: SEED_MARKER })) return;

  const categories = await categoryCollection();
  const now = new Date();
  await Promise.all(
    STAFF_CONFIG.defaultCategories.map((category, index) =>
      categories.updateOne(
        { _id: category.slug },
        {
          $setOnInsert: {
            name: category.name,
            role: category.role,
            description: "",
            order: index,
            system: true,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      ),
    ),
  );
  await ensureStaffIndexes();
  await state.updateOne({ _id: SEED_MARKER }, { $set: { at: now } }, { upsert: true });
}

export async function categoryMap(): Promise<Map<string, StaffCategory>> {
  if (categoryCache && Date.now() - categoryCache.loadedAt < STAFF_CONFIG.categoryCacheMs) {
    return categoryCache.categories;
  }
  await ensureDefaultCategories();
  const rows = await (await categoryCollection()).find().sort({ order: 1, name: 1 }).toArray();
  const categories = new Map(rows.map((row) => [row._id, row]));
  categoryCache = { loadedAt: Date.now(), categories };
  return categories;
}

export async function listCategories(): Promise<CategoryView[]> {
  invalidateCategories();
  const categories = await categoryMap();
  const counts = await (
    await accountCollection()
  )
    .aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ])
    .toArray();
  const byCategory = new Map(counts.map((row) => [row._id, row.count]));

  return [...categories.values()].map((category) => ({
    id: category._id,
    name: category.name,
    role: category.role,
    description: category.description ?? "",
    order: category.order,
    system: category.system,
    accounts: byCategory.get(category._id) ?? 0,
    updatedAt: category.updatedAt.toISOString(),
  }));
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function assertUniqueCategoryName(name: string, exceptId?: string): Promise<void> {
  const clash = [...(await categoryMap()).values()].find(
    (category) => category._id !== exceptId && category.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) throw new AdminError(`"${name}" নামে একটি ক্যাটাগরি আগে থেকেই আছে।`, 409);
}

export async function createCategory(
  input: { name: string; role: StaffRole; description?: string },
  actor: string,
): Promise<CategoryView> {
  const name = cleanText(input.name);
  await assertUniqueCategoryName(name);
  const categories = await categoryCollection();
  const last = await categories.find().sort({ order: -1 }).limit(1).next();
  const now = new Date();
  const id = `c-${randomBytes(5).toString("hex")}`;
  await categories.insertOne({
    _id: id,
    name,
    role: input.role,
    description: cleanText(input.description ?? ""),
    order: (last?.order ?? -1) + 1,
    system: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor,
  });
  invalidateCategories();
  const created = (await listCategories()).find((category) => category.id === id);
  if (!created) throw new AdminError("ক্যাটাগরি তৈরি করা যায়নি।", 500);
  return created;
}

export async function updateCategory(
  id: string,
  input: { name?: string; role?: StaffRole; description?: string; order?: number },
  actor: string,
): Promise<{
  category: CategoryView;
  previous: StaffCategory;
  roleChanged: boolean;
  signedOut: number;
}> {
  invalidateCategories();
  const current = (await categoryMap()).get(id);
  if (!current) throw new AdminError("ক্যাটাগরিটি পাওয়া যায়নি।", 404);

  const name = input.name === undefined ? undefined : cleanText(input.name);
  if (name !== undefined) await assertUniqueCategoryName(name, id);

  await (
    await categoryCollection()
  ).updateOne(
    { _id: id },
    {
      $set: {
        ...(name !== undefined ? { name } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.description !== undefined ? { description: cleanText(input.description) } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
        updatedAt: new Date(),
        updatedBy: actor,
      },
    },
  );
  invalidateCategories();

  const roleChanged = input.role !== undefined && input.role !== current.role;
  let signedOut = 0;
  if (roleChanged) {
    const accounts = await (
      await accountCollection()
    )
      .find({ categoryId: id }, { projection: { email: 1 } })
      .toArray();
    const removed = await Promise.all(
      accounts.map((account) => deleteSessionsByEmail(account.email)),
    );
    signedOut = removed.filter((count) => count > 0).length;
  }

  const category = (await listCategories()).find((row) => row.id === id);
  if (!category) throw new AdminError("ক্যাটাগরিটি পাওয়া যায়নি।", 404);
  return { category, previous: current, roleChanged, signedOut };
}

export function planCategoryOrder(
  categories: readonly { id: string; order: number }[],
  ids: readonly string[],
): { id: string; order: number }[] {
  const known = new Set(categories.map((category) => category.id));
  if (
    ids.length !== known.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !known.has(id))
  ) {
    throw new AdminError("ক্যাটাগরির তালিকা বদলে গেছে। পাতাটি নতুন করে লোড করে আবার সাজান।", 409);
  }
  const current = new Map(categories.map((category) => [category.id, category.order]));
  return ids
    .map((id, order) => ({ id, order }))
    .filter((entry) => current.get(entry.id) !== entry.order);
}

export async function reorderCategories(
  ids: readonly string[],
  actor: string,
): Promise<{ categories: CategoryView[]; moved: number }> {
  invalidateCategories();
  const categories = [...(await categoryMap()).values()].map((category) => ({
    id: category._id,
    order: category.order,
  }));
  const changes = planCategoryOrder(categories, ids);
  if (changes.length > 0) {
    const now = new Date();
    await (
      await categoryCollection()
    ).bulkWrite(
      changes.map((change) => ({
        updateOne: {
          filter: { _id: change.id },
          update: { $set: { order: change.order, updatedAt: now, updatedBy: actor } },
        },
      })),
    );
    invalidateCategories();
  }
  return { categories: await listCategories(), moved: changes.length };
}

export async function deleteCategory(id: string): Promise<StaffCategory> {
  const current = (await categoryMap()).get(id);
  if (!current) throw new AdminError("ক্যাটাগরিটি পাওয়া যায়নি।", 404);
  const inUse = await (await accountCollection()).countDocuments({ categoryId: id });
  if (inUse > 0) {
    throw new AdminError(
      `এই ক্যাটাগরিতে ${inUse}টি অ্যাকাউন্ট আছে। আগে সেগুলোকে অন্য ক্যাটাগরিতে সরান।`,
      409,
    );
  }
  await (await categoryCollection()).deleteOne({ _id: id });
  invalidateCategories();
  return current;
}

function parseObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new AdminError("অ্যাকাউন্টটি পাওয়া যায়নি।", 404);
  return new ObjectId(id);
}

export function toStaffView(
  account: StaffAccount,
  categories: Map<string, StaffCategory>,
): StaffView {
  const category = categories.get(account.categoryId);
  return {
    id: account._id.toHexString(),
    email: account.email,
    name: account.name,
    phone: account.phone ?? null,
    categoryId: account.categoryId,
    categoryName: category?.name ?? "ক্যাটাগরি নেই",
    role: category?.role ?? null,
    status: account.status,
    mustChangePassword: account.mustChangePassword,
    lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
    passwordChangedAt: account.passwordChangedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    createdBy: account.createdBy,
    updatedAt: account.updatedAt.toISOString(),
    updatedBy: account.updatedBy,
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listStaff(options: {
  search?: string;
  categoryId?: string;
  status?: StaffStatus;
  cursor?: string | null;
  limit: number;
}): Promise<{ items: StaffView[]; nextCursor: string | null; total: number | null }> {
  const filter: Filter<StaffAccount> = {};
  if (options.categoryId) filter.categoryId = options.categoryId;
  if (options.status) filter.status = options.status;
  const search = options.search?.trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search.slice(0, 100)), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }

  const accounts = await accountCollection();
  const pageFilter: Filter<StaffAccount> =
    options.cursor && ObjectId.isValid(options.cursor)
      ? { ...filter, _id: { $lt: new ObjectId(options.cursor) } }
      : filter;
  const [rows, total, categories] = await Promise.all([
    accounts
      .find(pageFilter)
      .sort({ _id: -1 })
      .limit(options.limit + 1)
      .toArray(),
    options.cursor ? Promise.resolve(null) : accounts.countDocuments(filter),
    categoryMap(),
  ]);
  const page = rows.slice(0, options.limit);

  return {
    items: page.map((row) => toStaffView(row, categories)),
    nextCursor: rows.length > options.limit ? (page.at(-1)?._id.toHexString() ?? null) : null,
    total,
  };
}

export async function getStaff(id: string): Promise<StaffView> {
  const [account, categories] = await Promise.all([
    (await accountCollection()).findOne({ _id: parseObjectId(id) }),
    categoryMap(),
  ]);
  if (!account) throw new AdminError("অ্যাকাউন্টটি পাওয়া যায়নি।", 404);
  return toStaffView(account, categories);
}

async function assertCategory(categoryId: string): Promise<StaffCategory> {
  const category = (await categoryMap()).get(categoryId);
  if (!category) throw new AdminError("ক্যাটাগরিটি পাওয়া যায়নি।", 422);
  return category;
}

async function assertEmailAvailable(email: string, exceptId?: ObjectId): Promise<void> {
  if (isAdminEmail(email)) {
    throw new AdminError("এই ইমেইলটি অ্যাডমিনের জন্য সংরক্ষিত, অন্য ইমেইল দিন।", 409);
  }
  const clash = await (
    await accountCollection()
  ).findOne({ email, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, { projection: { _id: 1 } });
  if (clash) throw new AdminError("এই ইমেইলে আগে থেকেই একটি অ্যাকাউন্ট আছে।", 409);
}

export async function createStaff(
  input: { email: string; name: string; phone?: string; categoryId: string; password: string },
  actor: string,
): Promise<StaffView> {
  await ensureStaffIndexes();
  const email = normalizeEmail(input.email);
  await assertEmailAvailable(email);
  await assertCategory(input.categoryId);
  const now = new Date();
  const phone = input.phone?.trim();

  const result = await (
    await accountCollection()
  )
    .insertOne({
      _id: new ObjectId(),
      email,
      name: cleanText(input.name),
      ...(phone ? { phone } : {}),
      categoryId: input.categoryId,
      passwordHash: await hashPassword(input.password),
      mustChangePassword: true,
      status: "active",
      createdAt: now,
      createdBy: actor,
      updatedAt: now,
      updatedBy: actor,
    })
    .catch(rethrowDuplicateEmail);
  return getStaff(result.insertedId.toHexString());
}

function rethrowDuplicateEmail(error: unknown): never {
  if (error instanceof MongoServerError && error.code === 11000) {
    throw new AdminError("এই ইমেইলে আগে থেকেই একটি অ্যাকাউন্ট আছে।", 409);
  }
  throw error;
}

export async function updateStaff(
  id: string,
  input: {
    email?: string;
    name?: string;
    phone?: string | null;
    categoryId?: string;
    status?: StaffStatus;
  },
  actor: string,
): Promise<{ account: StaffView; signedOut: boolean }> {
  const objectId = parseObjectId(id);
  const accounts = await accountCollection();
  const current = await accounts.findOne({ _id: objectId });
  if (!current) throw new AdminError("অ্যাকাউন্টটি পাওয়া যায়নি।", 404);

  const email = input.email === undefined ? undefined : normalizeEmail(input.email);
  if (email !== undefined && email !== current.email) await assertEmailAvailable(email, objectId);
  if (input.categoryId !== undefined) await assertCategory(input.categoryId);

  const phone = input.phone === undefined ? undefined : (input.phone ?? "").trim();
  await accounts
    .updateOne(
      { _id: objectId },
      {
        $set: {
          ...(email !== undefined ? { email } : {}),
          ...(input.name !== undefined ? { name: cleanText(input.name) } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(phone ? { phone } : {}),
          updatedAt: new Date(),
          updatedBy: actor,
        },
        ...(phone === "" ? { $unset: { phone: "" } } : {}),
      },
    )
    .catch(rethrowDuplicateEmail);

  const categories = await categoryMap();
  const roleChanged =
    input.categoryId !== undefined &&
    categories.get(input.categoryId)?.role !== categories.get(current.categoryId)?.role;
  const signOut =
    (email !== undefined && email !== current.email) || input.status === "suspended" || roleChanged;
  if (signOut) {
    await deleteSessionsByEmail(current.email);
    await deleteResetTokensByEmail(current.email);
  }
  return { account: await getStaff(id), signedOut: signOut };
}

export async function resetStaffPassword(
  id: string,
  password: string,
  actor: string,
): Promise<StaffView> {
  const objectId = parseObjectId(id);
  const accounts = await accountCollection();
  const current = await accounts.findOne({ _id: objectId });
  if (!current) throw new AdminError("অ্যাকাউন্টটি পাওয়া যায়নি।", 404);
  await accounts.updateOne(
    { _id: objectId },
    {
      $set: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        updatedAt: new Date(),
        updatedBy: actor,
      },
    },
  );
  await deleteSessionsByEmail(current.email);
  await deleteResetTokensByEmail(current.email);
  return getStaff(id);
}

export async function deleteStaff(id: string): Promise<StaffView> {
  const account = await getStaff(id);
  await (await accountCollection()).deleteOne({ _id: parseObjectId(id) });
  await deleteSessionsByEmail(account.email);
  await deleteResetTokensByEmail(account.email);
  return account;
}

export async function findStaffByEmail(email: string): Promise<StaffAccount | null> {
  return (await accountCollection()).findOne({ email: normalizeEmail(email) });
}

export async function recordStaffLogin(account: StaffAccount): Promise<void> {
  await (
    await accountCollection()
  ).updateOne(
    { _id: account._id },
    { $set: { lastLoginAt: new Date() }, $unset: { failedLogins: "", lockedUntil: "" } },
  );
}

export async function setStaffPasswordByEmail(
  email: string,
  passwordHash: string,
  mustChangePassword: boolean,
): Promise<boolean> {
  const result = await (
    await accountCollection()
  ).updateOne(
    { email: normalizeEmail(email) },
    {
      $set: {
        passwordHash,
        mustChangePassword,
        passwordChangedAt: new Date(),
      },
    },
  );
  return result.matchedCount === 1;
}

export function describeStaffChanges(previous: StaffView, next: StaffView): string[] {
  const changes: string[] = [];
  if (previous.name !== next.name) changes.push("name changed");
  if (previous.email !== next.email) changes.push(`email ${previous.email} -> ${next.email}`);
  if ((previous.phone ?? "") !== (next.phone ?? "")) changes.push("phone changed");
  if (previous.categoryId !== next.categoryId) {
    changes.push(`category ${previous.categoryName} -> ${next.categoryName}`);
    if (previous.role !== next.role) changes.push(`role ${previous.role} -> ${next.role}`);
  }
  return changes;
}

const DEMO_SENDER_NOTE = "@demomailtrap.co";

export function isDemoSender(address: string): boolean {
  return address.toLowerCase().endsWith(DEMO_SENDER_NOTE);
}

export function emailFailureReason(error: string | undefined): string {
  const raw = (error ?? "").trim();
  if (!raw) return "ইমেইল পাঠানো যায়নি, কারণ জানা যায়নি।";
  if (/MAILTRAP_API_TOKEN/i.test(raw)) {
    return "ইমেইল পাঠানোর ব্যবস্থা চালু নেই, কারণ MAILTRAP_API_TOKEN সেট করা হয়নি।";
  }
  if (/demo domain/i.test(raw) || /account owner/i.test(raw)) {
    return "Mailtrap-এর ডেমো ডোমেইন থেকে শুধু Mailtrap অ্যাকাউন্টের মালিকের ঠিকানায় ইমেইল যায়, তাই এই ঠিকানায় পাঠানো যায়নি।";
  }
  if (/unauthori[sz]ed|forbidden|\b401\b|\b403\b|invalid (api )?token/i.test(raw)) {
    return "Mailtrap টোকেনটি গ্রহণ করেনি। টোকেন ঠিক আছে কি না এবং পাঠানোর অনুমতি আছে কি না দেখুন।";
  }
  if (/\b429\b|rate limit|too many/i.test(raw)) {
    return "Mailtrap-এর পাঠানোর সীমা পূর্ণ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";
  }
  if (/domain/i.test(raw) && /verif/i.test(raw)) {
    return "প্রেরকের ডোমেইন Mailtrap-এ যাচাই করা নেই।";
  }
  if (/ENOTFOUND|ECONN|ETIMEDOUT|fetch failed|network|timeout/i.test(raw)) {
    return "Mailtrap সার্ভারে পৌঁছানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।";
  }
  return `Mailtrap ইমেইল পাঠাতে পারেনি (${raw.slice(0, 160)})।`;
}

export interface StaffEmailOutcome {
  sent: boolean;
  recipient: string;
  reason: string | null;
  demoSender: boolean;
}

export async function sendStaffAccountEmail(
  kind: StaffEmailKind,
  account: StaffView,
  password: string,
): Promise<StaffEmailOutcome> {
  const demoSender = isDemoSender(senderAddress().email);
  try {
    await loadSiteDomain();
    const email = staffAccountEmail({
      kind,
      email: account.email,
      name: account.name,
      password,
      categoryName: account.categoryName,
      ...(account.role ? { role: account.role } : {}),
    });
    const result = await sendRenderedEmail(
      account.email,
      email,
      kind === "created" ? EMAIL_CONFIG.categories.welcome : EMAIL_CONFIG.categories.passwordReset,
    );
    return {
      sent: result.sent,
      recipient: account.email,
      reason: result.sent ? null : emailFailureReason(result.error),
      demoSender,
    };
  } catch (error) {
    logger.warn("Staff account email could not be prepared", {
      kind,
      error: String(error).slice(0, 200),
    });
    return {
      sent: false,
      recipient: account.email,
      reason: emailFailureReason(String(error)),
      demoSender,
    };
  }
}
