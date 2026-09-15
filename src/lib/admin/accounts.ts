import { randomBytes } from "node:crypto";
import { ADMIN_CONFIG, DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { isAdminEmail, normalizeEmail, tokenDigest } from "@/lib/admin/identity";
import { hashPassword, verifyPassword } from "@/lib/admin/password";
import { permissionsFor, ROLE_LABELS, type BaseRole, type Permission } from "@/lib/admin/roles";
import {
  categoryMap,
  findStaffByEmail,
  recordStaffLogin,
  setStaffPasswordByEmail,
  updateOwnStaffProfile,
  type StaffAccount,
} from "@/lib/admin/staff";
import { isEmailConfigured, senderAddress } from "@/lib/email/mailer";
import { getAdminEnv } from "@/lib/utils/env";

export { isAdminEmail, normalizeEmail, tokenDigest } from "@/lib/admin/identity";

export interface AdminAccount {
  _id: string;
  name?: string;
  phone?: string;
  passwordHash: string | null;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
}

interface ResetToken {
  _id: string;
  email: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Principal {
  kind: "admin" | "staff";
  principalId: string;
  email: string;
  name: string;
  role: BaseRole;
  roleLabel: string;
  categoryName: string;
  mustChangePassword: boolean;
  permissions: Permission[];
}

async function accounts() {
  return (await getDb()).collection<AdminAccount>(DB_CONFIG.adminAccountCollection);
}

async function resetTokens() {
  return (await getDb()).collection<ResetToken>(DB_CONFIG.adminResetTokenCollection);
}

export async function ensureAccount(email: string): Promise<AdminAccount | null> {
  const id = normalizeEmail(email);
  if (!isAdminEmail(id)) return null;

  const collection = await accounts();
  const existing = await collection.findOne({ _id: id });
  if (existing) return existing;

  const initial = getAdminEnv().ADMIN_INITIAL_PASSWORD;
  const now = new Date();
  await collection.updateOne(
    { _id: id },
    {
      $setOnInsert: {
        passwordHash: initial ? await hashPassword(initial) : null,
        createdAt: now,
        ...(initial ? { passwordChangedAt: now } : {}),
      },
    },
    { upsert: true },
  );
  return collection.findOne({ _id: id });
}

async function activeStaff(email: string) {
  const account = await findStaffByEmail(email);
  if (!account || account.status !== "active") return null;
  const category = (await categoryMap()).get(account.categoryId);
  return category ? { account, category } : null;
}

export async function resolvePrincipal(email: string): Promise<Principal | null> {
  const address = normalizeEmail(email);
  if (isAdminEmail(address)) {
    const account = await ensureAccount(address);
    return {
      kind: "admin",
      principalId: address,
      email: address,
      name: account?.name?.trim() || (address.split("@")[0] ?? address),
      role: "admin",
      roleLabel: ROLE_LABELS.admin,
      categoryName: ROLE_LABELS.admin,
      mustChangePassword: false,
      permissions: permissionsFor("admin"),
    };
  }

  const staff = await activeStaff(address);
  if (!staff) return null;
  return {
    kind: "staff",
    principalId: staff.account._id.toHexString(),
    email: staff.account.email,
    name: staff.account.name,
    role: staff.category.role,
    roleLabel: ROLE_LABELS[staff.category.role],
    categoryName: staff.category.name,
    mustChangePassword: staff.account.mustChangePassword,
    permissions: permissionsFor(staff.category.role),
  };
}

export type LoginResult = { ok: true; email: string } | { ok: false; reason: "invalid" };

interface LoginTarget {
  passwordHash: string | null;
  recordLogin: () => Promise<void>;
}

async function loginTarget(email: string): Promise<LoginTarget | null> {
  const admin = await ensureAccount(email);
  if (admin) {
    const collection = await accounts();
    return {
      passwordHash: admin.passwordHash,
      recordLogin: async () => {
        await collection.updateOne(
          { _id: admin._id },
          { $set: { lastLoginAt: new Date() }, $unset: { failedLogins: "", lockedUntil: "" } },
        );
      },
    };
  }

  const staff = await activeStaff(email);
  if (!staff) return null;
  const account: StaffAccount = staff.account;
  return {
    passwordHash: account.passwordHash,
    recordLogin: () => recordStaffLogin(account),
  };
}

export async function authenticate(email: string, password: string): Promise<LoginResult> {
  const address = normalizeEmail(email);
  const target = await loginTarget(address);
  if (!target) {
    await verifyPassword(password, null);
    return { ok: false, reason: "invalid" };
  }

  if (await verifyPassword(password, target.passwordHash)) {
    await target.recordLogin();
    return { ok: true, email: address };
  }
  return { ok: false, reason: "invalid" };
}

export async function setPassword(email: string, password: string): Promise<void> {
  const address = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  if (isAdminEmail(address)) {
    await (
      await accounts()
    ).updateOne({ _id: address }, { $set: { passwordHash, passwordChangedAt: new Date() } });
    return;
  }
  await setStaffPasswordByEmail(address, passwordHash, false);
}

export async function checkPassword(email: string, password: string): Promise<boolean> {
  const target = await loginTarget(normalizeEmail(email));
  return target ? verifyPassword(password, target.passwordHash) : false;
}

export async function accountSummary(email: string) {
  const address = normalizeEmail(email);
  const principal = await resolvePrincipal(address);
  if (!principal) return null;

  let passwordChangedAt: Date | undefined;
  let lastLoginAt: Date | undefined;
  let hasPassword = true;
  let phone: string | null = null;
  if (principal.kind === "admin") {
    const account = await ensureAccount(address);
    passwordChangedAt = account?.passwordChangedAt;
    lastLoginAt = account?.lastLoginAt;
    hasPassword = Boolean(account?.passwordHash);
    phone = account?.phone ?? null;
  } else {
    const account = await findStaffByEmail(address);
    passwordChangedAt = account?.passwordChangedAt;
    lastLoginAt = account?.lastLoginAt;
    phone = account?.phone ?? null;
  }

  const sender = senderAddress().email;
  const isAdmin = principal.kind === "admin";
  return {
    email: principal.email,
    name: principal.name,
    kind: principal.kind,
    role: principal.role,
    roleLabel: principal.roleLabel,
    categoryName: principal.categoryName,
    phone,
    mustChangePassword: principal.mustChangePassword,
    hasPassword,
    passwordChangedAt: passwordChangedAt?.toISOString() ?? null,
    lastLoginAt: lastLoginAt?.toISOString() ?? null,
    ...(isAdmin
      ? {
          emailConfigured: isEmailConfigured(),
          emailSender: sender,
          demoSender: sender.endsWith("@demomailtrap.co"),
        }
      : {}),
  };
}

export async function updateOwnProfile(
  email: string,
  input: { name: string; phone?: string | null },
): Promise<void> {
  const address = normalizeEmail(email);
  if (!isAdminEmail(address)) {
    await updateOwnStaffProfile(address, input);
    return;
  }
  await ensureAccount(address);
  const phone = input.phone?.trim();
  await (
    await accounts()
  ).updateOne(
    { _id: address },
    {
      $set: { name: input.name.replace(/\s+/g, " ").trim(), ...(phone ? { phone } : {}) },
      ...(phone ? {} : { $unset: { phone: "" } }),
    },
  );
}

async function isKnownAccount(email: string): Promise<boolean> {
  return isAdminEmail(email)
    ? Boolean(await ensureAccount(email))
    : Boolean(await activeStaff(email));
}

export async function createResetToken(email: string): Promise<string | null> {
  const address = normalizeEmail(email);
  if (!(await isKnownAccount(address))) return null;

  const collection = await resetTokens();
  const hourAgo = new Date(Date.now() - 3_600_000);
  const recent = await collection.countDocuments({ email: address, createdAt: { $gt: hourAgo } });
  if (recent >= ADMIN_CONFIG.maxResetRequestsPerHour) return null;

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await collection.insertOne({
    _id: tokenDigest(token),
    email: address,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ADMIN_CONFIG.resetMinutes * 60_000),
  });
  return token;
}

export async function resetTokenEmail(token: string): Promise<string | null> {
  const record = await (
    await resetTokens()
  ).findOne({ _id: tokenDigest(token), expiresAt: { $gt: new Date() } });
  return record && (await isKnownAccount(record.email)) ? record.email : null;
}

export async function consumeResetToken(token: string): Promise<string | null> {
  const record = await (
    await resetTokens()
  ).findOneAndDelete({ _id: tokenDigest(token), expiresAt: { $gt: new Date() } });
  if (!record || !(await isKnownAccount(record.email))) return null;
  await (await resetTokens()).deleteMany({ email: record.email });
  return record.email;
}
