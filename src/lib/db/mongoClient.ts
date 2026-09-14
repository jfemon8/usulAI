import { MongoClient, type Binary, type Collection, type Db } from "mongodb";
import { DB_CONFIG } from "@/config/site";
import { getDbEnv } from "@/lib/utils/env";
import type { StoredCitation } from "@/lib/db/documentShape";
import type { SourceType } from "@/types";

export interface DocumentRecord {
  sourceType: SourceType;
  content: string;
  citation: StoredCitation;
  metadata: Record<string, unknown>;
  contentHash?: string | Binary;
  embedding?: Binary;
  embeddingModel?: string;
}

declare global {
  var __usulMongoClient: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  const { MONGODB_URI, MONGODB_MAX_POOL_SIZE } = getDbEnv();

  return new MongoClient(MONGODB_URI, {
    retryWrites: true,
    maxPoolSize: MONGODB_MAX_POOL_SIZE,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 10_000,
  }).connect();
}

export function getMongoClient(): Promise<MongoClient> {
  if (!globalThis.__usulMongoClient) {
    globalThis.__usulMongoClient = connect().catch((error: unknown) => {
      globalThis.__usulMongoClient = undefined;
      throw error;
    });
  }
  return globalThis.__usulMongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getDbEnv().MONGODB_DB);
}

export async function getDocumentsCollection(): Promise<Collection<DocumentRecord>> {
  const db = await getDb();
  return db.collection<DocumentRecord>(DB_CONFIG.collection);
}
