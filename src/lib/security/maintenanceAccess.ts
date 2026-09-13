export type MaintenanceAccess = "secret" | "vercel-cron" | "denied";

export function maintenanceAccess(request: Request): MaintenanceAccess {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const ingestSecret = process.env.INGEST_API_SECRET?.trim();
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = request.headers.get("x-ingest-secret");

  if (cronSecret && bearer === cronSecret) return "secret";
  if (ingestSecret && header === ingestSecret) return "secret";
  if (!cronSecret && request.headers.get("user-agent")?.startsWith("vercel-cron/")) {
    return "vercel-cron";
  }
  return "denied";
}
