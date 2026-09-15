import { createHash } from "node:crypto";
import { MODEL_CONFIG, RETRIEVAL_CONFIG } from "@/config/site";
import { storedCitation, storedMetadata } from "@/lib/db/documentShape";
import type { IngestionDocument } from "@/types";

export interface StoredFingerprint {
  id: string;
  reference: string;
  hash: string;
  embedded: boolean;
  citation: unknown;
  metadata: Record<string, unknown>;
}

export interface PlannedChange {
  id: string;
  document: IngestionDocument;
}

export interface IngestionPlan {
  inserts: IngestionDocument[];
  changed: PlannedChange[];
  metadataOnly: PlannedChange[];
  unchanged: number;
  stale: string[];
  duplicates: string[];
}

export function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function currentEmbeddingModel(): string {
  return `${MODEL_CONFIG.embedding.model}@${RETRIEVAL_CONFIG.embeddingDimensions}`;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function describedChanged(incoming: IngestionDocument, stored: StoredFingerprint): boolean {
  const citation = storedCitation(incoming.citation, incoming.sourceType, incoming.metadata);
  if (canonical(citation) !== canonical(stored.citation)) return true;

  return Object.entries(
    storedMetadata(incoming.metadata ?? {}, incoming.sourceType, incoming.citation.reference),
  ).some(([key, value]) => canonical(value) !== canonical(stored.metadata[key]));
}

export function planIngestion(
  incoming: IngestionDocument[],
  stored: StoredFingerprint[],
): IngestionPlan {
  const survivors = new Map<string, StoredFingerprint>();
  const duplicates: string[] = [];

  for (const record of stored) {
    const current = survivors.get(record.reference);
    if (!current) {
      survivors.set(record.reference, record);
    } else if (record.embedded && !current.embedded) {
      duplicates.push(current.id);
      survivors.set(record.reference, record);
    } else {
      duplicates.push(record.id);
    }
  }

  const plan: IngestionPlan = {
    inserts: [],
    changed: [],
    metadataOnly: [],
    unchanged: 0,
    stale: [],
    duplicates,
  };
  const seen = new Set<string>();

  for (const document of incoming) {
    const reference = document.citation.reference;
    if (seen.has(reference)) continue;
    seen.add(reference);

    const existing = survivors.get(reference);

    if (!existing) plan.inserts.push(document);
    else if (existing.hash !== contentHash(document.content)) {
      plan.changed.push({ id: existing.id, document });
    } else if (describedChanged(document, existing)) {
      plan.metadataOnly.push({ id: existing.id, document });
    } else {
      plan.unchanged += 1;
    }
  }

  const loadedFiles = new Set(
    incoming.map((document) => document.metadata?.fileName).filter(Boolean),
  );

  for (const [reference, record] of survivors) {
    if (seen.has(reference)) continue;
    const privateFileMissing =
      record.metadata.restricted === true && !loadedFiles.has(record.metadata.fileName);
    if (!privateFileMissing) plan.stale.push(record.id);
  }

  return plan;
}
