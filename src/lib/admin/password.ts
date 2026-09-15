import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { ADMIN_CONFIG } from "@/config/site";

const PREFIX = "scrypt";

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const { cost, blockSize, parallelization, keyLength, maxMemory } = ADMIN_CONFIG.scrypt;
  const salt = randomBytes(16);
  const key = await derive(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: maxMemory,
  });
  return [
    PREFIX,
    cost,
    blockSize,
    parallelization,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  const parts = (stored ?? "").split("$");
  const [prefix, cost, blockSize, parallelization, salt, key] = parts;

  if (parts.length !== 6 || prefix !== PREFIX || !salt || !key) {
    await hashPassword(password);
    return false;
  }

  const expected = Buffer.from(key, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
    maxmem: ADMIN_CONFIG.scrypt.maxMemory,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type PasswordProblem = "short" | "long" | "mismatch" | "same";

export function passwordProblem(
  password: string,
  confirmation: string,
  current?: string,
): PasswordProblem | null {
  if (password.length < ADMIN_CONFIG.minPasswordChars) return "short";
  if (password.length > ADMIN_CONFIG.maxPasswordChars) return "long";
  if (password !== confirmation) return "mismatch";
  if (current !== undefined && password === current) return "same";
  return null;
}

export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  short: `নতুন পাসওয়ার্ড অন্তত ${ADMIN_CONFIG.minPasswordChars} অক্ষরের হতে হবে।`,
  long: `পাসওয়ার্ড ${ADMIN_CONFIG.maxPasswordChars} অক্ষরের বেশি হতে পারবে না।`,
  mismatch: "দুই ঘরের পাসওয়ার্ড মিলছে না।",
  same: "নতুন পাসওয়ার্ড বর্তমান পাসওয়ার্ডের মতো হতে পারবে না।",
};
