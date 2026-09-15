import { createHash } from "node:crypto";
import { ADMIN_CONFIG } from "@/config/site";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string): boolean {
  return (ADMIN_CONFIG.accounts as readonly string[]).includes(normalizeEmail(email));
}

export function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
