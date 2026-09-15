import { DB_CONFIG } from "@/config/site";
import { getDb } from "@/lib/db/mongoClient";

export interface StoredSession {
  _id: string;
  email: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent: string;
  client: string;
}

export async function sessionCollection() {
  return (await getDb()).collection<StoredSession>(DB_CONFIG.adminSessionCollection);
}

export async function deleteSessionsByEmail(email: string, keepId?: string): Promise<number> {
  const result = await (
    await sessionCollection()
  ).deleteMany({ email, ...(keepId ? { _id: { $ne: keepId } } : {}) });
  return result.deletedCount;
}

export async function deleteResetTokensByEmail(email: string): Promise<void> {
  await (await getDb()).collection(DB_CONFIG.adminResetTokenCollection).deleteMany({ email });
}
