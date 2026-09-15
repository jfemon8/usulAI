import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { tokenDigest } from "@/lib/admin/identity";

const SIGNED_PREFIX = "r.";
const TRACKING_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SIGNED_PATTERN = /^r\.([0-9a-f]{24})\.([A-Za-z0-9_-]{43})$/;

export type HelpAccess = { kind: "tracking"; digest: string } | { kind: "signed"; id: string };

export function newTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

export function signingSecret(): string | null {
  const secret = process.env.INGEST_API_SECRET?.trim();
  return secret ? secret : null;
}

function signature(id: string, secret: string): string {
  return createHmac("sha256", secret).update(`help-request:${id}`).digest("base64url");
}

export function signedHelpToken(
  id: string,
  secret: string | null = signingSecret(),
): string | null {
  if (!secret || !/^[0-9a-f]{24}$/.test(id)) return null;
  return `${SIGNED_PREFIX}${id}.${signature(id, secret)}`;
}

export function verifySignedHelpToken(
  token: string,
  secret: string | null = signingSecret(),
): string | null {
  const match = SIGNED_PATTERN.exec(token);
  if (!secret || !match?.[1] || !match[2]) return null;
  const expected = Buffer.from(signature(match[1], secret));
  const given = Buffer.from(match[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return match[1];
}

export function parseHelpAccess(
  token: string,
  secret: string | null = signingSecret(),
): HelpAccess | null {
  if (TRACKING_PATTERN.test(token)) return { kind: "tracking", digest: tokenDigest(token) };
  const id = verifySignedHelpToken(token, secret);
  return id ? { kind: "signed", id } : null;
}

export function isHelpTokenShape(token: string): boolean {
  return TRACKING_PATTERN.test(token) || SIGNED_PATTERN.test(token);
}
