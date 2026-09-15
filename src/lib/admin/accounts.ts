import { createHash, randomBytes } from "node:crypto";
import { ADMIN_CONFIG, DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { hashPassword, verifyPassword } from "@/lib/admin/password";
import { isEmailConfigured, senderAddress } from "@/lib/email/mailer";
import { getAdminEnv } from "@/lib/utils/env";

export interface AdminAccount {
  _id: string;
  passwordHash: string | null;
  passwordChangedAt?: Date;
  failedLogins: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date;
  createdAt: Date;
}

interface ResetToken {
  _id: string;
  email: string;
  expiresAt: Date;
  createdAt: Date;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string): boolean {
  return (ADMIN_CONFIG.accounts as readonly string[]).includes(normalizeEmail(email));
}

export function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
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
        failedLogins: 0,
        lockedUntil: null,
        createdAt: now,
        ...(initial ? { passwordChangedAt: now } : {}),
      },
    },
    { upsert: true },
  );
  return collection.findOne({ _id: id });
}

export type LoginResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; minutes: number };

export async function authenticate(email: string, password: string): Promise<LoginResult> {
  const account = await ensureAccount(email);
  if (!account) {
    await verifyPassword(password, null);
    return { ok: false, reason: "invalid" };
  }

  const now = Date.now();
  if (account.lockedUntil && account.lockedUntil.getTime() > now) {
    return {
      ok: false,
      reason: "locked",
      minutes: Math.ceil((account.lockedUntil.getTime() - now) / 60_000),
    };
  }

  const collection = await accounts();
  if (await verifyPassword(password, account.passwordHash)) {
    await collection.updateOne(
      { _id: account._id },
      { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } },
    );
    return { ok: true, email: account._id };
  }

  const failures = (account.lockedUntil ? 0 : account.failedLogins) + 1;
  const locked = failures >= ADMIN_CONFIG.maxFailedLogins;
  await collection.updateOne(
    { _id: account._id },
    {
      $set: {
        failedLogins: locked ? 0 : failures,
        lockedUntil: locked ? new Date(now + ADMIN_CONFIG.lockoutMinutes * 60_000) : null,
      },
    },
  );
  return locked
    ? { ok: false, reason: "locked", minutes: ADMIN_CONFIG.lockoutMinutes }
    : { ok: false, reason: "invalid" };
}

export async function setPassword(email: string, password: string): Promise<void> {
  await (
    await accounts()
  ).updateOne(
    { _id: normalizeEmail(email) },
    {
      $set: {
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        failedLogins: 0,
        lockedUntil: null,
      },
    },
  );
}

export async function checkPassword(email: string, password: string): Promise<boolean> {
  const account = await ensureAccount(email);
  return account ? verifyPassword(password, account.passwordHash) : false;
}

export async function accountSummary(email: string) {
  const account = await ensureAccount(email);
  if (!account) return null;
  const sender = senderAddress().email;
  return {
    email: account._id,
    hasPassword: Boolean(account.passwordHash),
    passwordChangedAt: account.passwordChangedAt?.toISOString() ?? null,
    lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
    emailConfigured: isEmailConfigured(),
    emailSender: sender,
    demoSender: sender.endsWith("@demomailtrap.co"),
  };
}

export async function createResetToken(email: string): Promise<string | null> {
  const account = await ensureAccount(email);
  if (!account) return null;

  const collection = await resetTokens();
  const hourAgo = new Date(Date.now() - 3_600_000);
  const recent = await collection.countDocuments({
    email: account._id,
    createdAt: { $gt: hourAgo },
  });
  if (recent >= ADMIN_CONFIG.maxResetRequestsPerHour) return null;

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await collection.insertOne({
    _id: tokenDigest(token),
    email: account._id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ADMIN_CONFIG.resetMinutes * 60_000),
  });
  return token;
}

export async function resetTokenEmail(token: string): Promise<string | null> {
  const record = await (
    await resetTokens()
  ).findOne({ _id: tokenDigest(token), expiresAt: { $gt: new Date() } });
  return record && isAdminEmail(record.email) ? record.email : null;
}

export async function consumeResetToken(token: string): Promise<string | null> {
  const record = await (
    await resetTokens()
  ).findOneAndDelete({ _id: tokenDigest(token), expiresAt: { $gt: new Date() } });
  if (!record || !isAdminEmail(record.email)) return null;
  await (await resetTokens()).deleteMany({ email: record.email });
  return record.email;
}
