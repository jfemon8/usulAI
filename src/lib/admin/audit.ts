import { DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";
import { logger } from "@/lib/utils/logger";

export interface AuditEntry {
  at: Date;
  email: string;
  action: string;
  target?: string;
  detail?: string;
}

export async function recordAudit(
  email: string,
  action: string,
  target?: string,
  detail?: string,
): Promise<void> {
  try {
    await (await getDb()).collection<AuditEntry>(DB_CONFIG.adminAuditCollection).insertOne({
      at: new Date(),
      email,
      action,
      ...(target ? { target: target.slice(0, 300) } : {}),
      ...(detail ? { detail: detail.slice(0, 500) } : {}),
    });
  } catch (error) {
    logger.warn("Admin audit write failed", { action, error: String(error).slice(0, 160) });
  }
}

export async function listAudit(options: { limit: number; before?: Date; email?: string }) {
  const rows = await (
    await getDb()
  )
    .collection<AuditEntry>(DB_CONFIG.adminAuditCollection)
    .find({
      ...(options.before ? { at: { $lt: options.before } } : {}),
      ...(options.email ? { email: options.email } : {}),
    })
    .sort({ at: -1 })
    .limit(options.limit + 1)
    .toArray();

  const page = rows.slice(0, options.limit);
  return {
    items: page.map((row) => ({
      id: String(row._id),
      at: row.at.toISOString(),
      email: row.email,
      action: row.action,
      target: row.target ?? null,
      detail: row.detail ?? null,
    })),
    nextBefore: rows.length > options.limit ? (page.at(-1)?.at.toISOString() ?? null) : null,
  };
}
