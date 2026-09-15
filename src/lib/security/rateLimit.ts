import { createHash } from "crypto";
import { DB_CONFIG, RATE_LIMIT_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import type { ScopeUsage, WindowUsage } from "@/lib/usage/types";
import { logger } from "@/lib/utils/logger";

export type RateScope = keyof typeof RATE_LIMIT_CONFIG.scopes;

const WINDOWS = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
} as const;

type WindowName = keyof typeof WINDOWS;

interface Counter {
  w: number;
  c: number;
}

type CounterDoc = Partial<Record<WindowName, Counter>>;

export type RateDecision =
  { allowed: true } | { allowed: false; window: WindowName; retryAfterSeconds: number };

export function clientAddress(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return realIp || forwarded || "unknown";
}

export function clientKey(request: Request): string {
  const salt = process.env.INGEST_API_SECRET ?? "usul-ai";
  return createHash("sha256")
    .update(`${salt}:${clientAddress(request)}`)
    .digest("hex")
    .slice(0, 24);
}

export function windowIndex(now: number, window: WindowName): number {
  return Math.floor(now / WINDOWS[window]);
}

export function decide(
  doc: CounterDoc,
  limits: Partial<Record<WindowName, number>>,
  now: number,
): RateDecision {
  for (const window of Object.keys(WINDOWS) as WindowName[]) {
    const limit = limits[window];
    const counter = doc[window];
    if (limit === undefined || !counter) continue;
    if (counter.w !== windowIndex(now, window) || counter.c <= limit) continue;

    const resetsAt = (counter.w + 1) * WINDOWS[window];
    return {
      allowed: false,
      window,
      retryAfterSeconds: Math.max(1, Math.ceil((resetsAt - now) / 1000)),
    };
  }

  return { allowed: true };
}

function incrementPipeline(windows: WindowName[], now: number) {
  const fields = Object.fromEntries(
    windows.map((window) => {
      const current = windowIndex(now, window);
      return [
        window,
        {
          $cond: [
            { $eq: [`$${window}.w`, current] },
            { w: current, c: { $add: [`$${window}.c`, 1] } },
            { w: current, c: 1 },
          ],
        },
      ];
    }),
  );

  return [{ $set: { ...fields, expiresAt: new Date(now + WINDOWS.day) } }];
}

async function bump(id: string, windows: WindowName[], now: number): Promise<CounterDoc> {
  const collection = (await getDb()).collection<{ _id: string } & CounterDoc>(
    DB_CONFIG.rateLimitCollection,
  );

  const doc = await collection.findOneAndUpdate({ _id: id }, incrementPipeline(windows, now), {
    upsert: true,
    returnDocument: "after",
  });

  return doc ?? {};
}

export async function consumeRateLimit(scope: RateScope, request: Request): Promise<RateDecision> {
  const limits = RATE_LIMIT_CONFIG.scopes[scope];
  const now = Date.now();

  try {
    const client = await bump(`${scope}:${clientKey(request)}`, ["minute", "hour", "day"], now);
    return decide(client, limits, now);
  } catch (error) {
    logger.warn("Rate limit check failed, allowing the request", {
      scope,
      error: String(error).slice(0, 160),
    });
    return { allowed: true };
  }
}

function windowUsage(
  counter: Counter | undefined,
  limit: number,
  window: WindowName,
  now: number,
): WindowUsage {
  const current = windowIndex(now, window);
  return {
    used: counter && counter.w === current ? counter.c : 0,
    limit,
    resetsAt: (current + 1) * WINDOWS[window],
  };
}

export function usageFrom(
  client: CounterDoc,
  limits: { minute: number; hour: number; day: number },
  now: number,
): ScopeUsage {
  return {
    minute: windowUsage(client.minute, limits.minute, "minute", now),
    hour: windowUsage(client.hour, limits.hour, "hour", now),
    day: windowUsage(client.day, limits.day, "day", now),
  };
}

export async function readRateUsage(
  scope: RateScope,
  request: Request,
  now: number = Date.now(),
): Promise<ScopeUsage> {
  const collection = (await getDb()).collection<{ _id: string } & CounterDoc>(
    DB_CONFIG.rateLimitCollection,
  );
  const client = await collection.findOne({ _id: `${scope}:${clientKey(request)}` });
  return usageFrom(client ?? {}, RATE_LIMIT_CONFIG.scopes[scope], now);
}

export function rateLimitResponse(decision: Extract<RateDecision, { allowed: false }>): Response {
  const message = `খুব অল্প সময়ে অনেকগুলো প্রশ্ন করা হয়েছে। অনুগ্রহ করে ${decision.retryAfterSeconds} সেকেন্ড পর আবার চেষ্টা করুন।`;

  return new Response(
    JSON.stringify({ error: message, retryAfterSeconds: decision.retryAfterSeconds }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": String(decision.retryAfterSeconds),
      },
    },
  );
}
