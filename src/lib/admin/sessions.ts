import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_CONFIG, DB_CONFIG } from "@/config/site";
import { isAdminEmail, tokenDigest } from "@/lib/admin/accounts";
import { getDb } from "@/lib/db/mongoClient";
import { clientKey } from "@/lib/security/rateLimit";

interface StoredSession {
  _id: string;
  email: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent: string;
  client: string;
}

export interface AdminSession {
  id: string;
  email: string;
  createdAt: Date;
}

export interface SessionSummary {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
}

const DAY_MS = 86_400_000;

async function sessions() {
  return (await getDb()).collection<StoredSession>(DB_CONFIG.adminSessionCollection);
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires,
  };
}

export async function createSession(email: string, request: Request): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_CONFIG.sessionDays * DAY_MS);

  await (
    await sessions()
  ).insertOne({
    _id: tokenDigest(token),
    email,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    client: clientKey(request),
  });

  (await cookies()).set(ADMIN_CONFIG.sessionCookie, token, cookieOptions(expiresAt));
}

async function currentToken(): Promise<string | null> {
  return (await cookies()).get(ADMIN_CONFIG.sessionCookie)?.value ?? null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = await currentToken();
  if (!token) return null;

  try {
    const collection = await sessions();
    const id = tokenDigest(token);
    const stored = await collection.findOne({ _id: id, expiresAt: { $gt: new Date() } });
    if (!stored || !isAdminEmail(stored.email)) return null;

    if (Date.now() - stored.lastSeenAt.getTime() > ADMIN_CONFIG.sessionTouchMinutes * 60_000) {
      await collection.updateOne({ _id: id }, { $set: { lastSeenAt: new Date() } });
    }
    return { id, email: stored.email, createdAt: stored.createdAt };
  } catch {
    return null;
  }
}

export async function destroyCurrentSession(): Promise<void> {
  const token = await currentToken();
  if (token) await (await sessions()).deleteOne({ _id: tokenDigest(token) });
  (await cookies()).delete(ADMIN_CONFIG.sessionCookie);
}

export async function destroySessions(email: string, keepId?: string): Promise<number> {
  const result = await (
    await sessions()
  ).deleteMany({ email, ...(keepId ? { _id: { $ne: keepId } } : {}) });
  return result.deletedCount;
}

export async function destroySession(email: string, id: string): Promise<boolean> {
  return (await (await sessions()).deleteOne({ _id: id, email })).deletedCount === 1;
}

export async function listSessions(session: AdminSession): Promise<SessionSummary[]> {
  const rows = await (
    await sessions()
  )
    .find({ email: session.email, expiresAt: { $gt: new Date() } })
    .sort({ lastSeenAt: -1 })
    .limit(50)
    .toArray();

  return rows.map((row) => ({
    id: row._id,
    current: row._id === session.id,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    userAgent: row.userAgent,
  }));
}
