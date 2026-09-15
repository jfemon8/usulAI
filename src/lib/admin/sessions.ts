import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_CONFIG } from "@/config/site";
import { resolvePrincipal, type Principal } from "@/lib/admin/accounts";
import { tokenDigest } from "@/lib/admin/identity";
import type { PrincipalView } from "@/lib/admin/roles";
import { deleteSessionsByEmail, sessionCollection } from "@/lib/admin/sessionStore";
import { clientKey } from "@/lib/security/rateLimit";

export interface AdminSession extends Principal {
  id: string;
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

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires,
  };
}

export function principalView(session: AdminSession): PrincipalView {
  return {
    kind: session.kind,
    id: session.principalId,
    email: session.email,
    name: session.name,
    role: session.role,
    roleLabel: session.roleLabel,
    categoryName: session.categoryName,
    mustChangePassword: session.mustChangePassword,
    permissions: session.permissions,
  };
}

export async function createSession(email: string, request: Request): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_CONFIG.sessionDays * DAY_MS);

  await (
    await sessionCollection()
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
    const collection = await sessionCollection();
    const id = tokenDigest(token);
    const stored = await collection.findOne({ _id: id, expiresAt: { $gt: new Date() } });
    if (!stored) return null;

    const principal = await resolvePrincipal(stored.email);
    if (!principal) return null;

    if (Date.now() - stored.lastSeenAt.getTime() > ADMIN_CONFIG.sessionTouchMinutes * 60_000) {
      await collection.updateOne({ _id: id }, { $set: { lastSeenAt: new Date() } });
    }
    return { ...principal, id, createdAt: stored.createdAt };
  } catch {
    return null;
  }
}

export async function destroyCurrentSession(): Promise<void> {
  const token = await currentToken();
  if (token) await (await sessionCollection()).deleteOne({ _id: tokenDigest(token) });
  (await cookies()).delete(ADMIN_CONFIG.sessionCookie);
}

export async function destroySessions(email: string, keepId?: string): Promise<number> {
  return deleteSessionsByEmail(email, keepId);
}

export async function destroySession(email: string, id: string): Promise<boolean> {
  return (await (await sessionCollection()).deleteOne({ _id: id, email })).deletedCount === 1;
}

export async function listSessions(session: AdminSession): Promise<SessionSummary[]> {
  const rows = await (
    await sessionCollection()
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
