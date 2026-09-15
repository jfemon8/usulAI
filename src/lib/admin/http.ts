import { NextResponse } from "next/server";
import type { z } from "zod";
import { getAdminSession, type AdminSession } from "@/lib/admin/sessions";
import { consumeRateLimit, rateLimitResponse, type RateScope } from "@/lib/security/rateLimit";
import { logger } from "@/lib/utils/logger";

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const NO_STORE = { "cache-control": "no-store" };

export function adminJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function adminFailure(message: string, status = 400): NextResponse {
  return adminJson({ error: message }, status);
}

export function isSameOrigin(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return true;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AdminError(
      issue
        ? `অনুরোধের তথ্য সঠিক নয়: ${issue.path.join(".") || "body"} (${issue.message})`
        : "অনুরোধের তথ্য সঠিক নয়।",
    );
  }
  return parsed.data;
}

function failure(error: unknown, route: string): NextResponse {
  if (error instanceof AdminError) return adminFailure(error.message, error.status);
  logger.error("Admin request failed", { route, error: String(error).slice(0, 300) });
  return adminFailure("সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", 500);
}

type Params = Record<string, string | string[]>;

export function publicAdminRoute(
  scope: RateScope,
  handler: (request: Request) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    if (!isSameOrigin(request)) return adminFailure("অনুরোধটি অনুমোদিত নয়।", 403);
    const limit = await consumeRateLimit(scope, request);
    if (!limit.allowed) return rateLimitResponse(limit, "অনুরোধ");
    try {
      return await handler(request);
    } catch (error) {
      return failure(error, new URL(request.url).pathname);
    }
  };
}

export function adminRoute<P extends Params = Params>(
  handler: (request: Request, session: AdminSession, params: P) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<P> }): Promise<Response> => {
    if (!isSameOrigin(request)) return adminFailure("অনুরোধটি অনুমোদিত নয়।", 403);
    const limit = await consumeRateLimit("admin", request);
    if (!limit.allowed) return rateLimitResponse(limit, "অনুরোধ");

    const session = await getAdminSession();
    if (!session) return adminFailure("লগইন করা নেই বা সেশনের মেয়াদ শেষ হয়েছে।", 401);

    try {
      return await handler(request, session, await context.params);
    } catch (error) {
      return failure(error, new URL(request.url).pathname);
    }
  };
}
