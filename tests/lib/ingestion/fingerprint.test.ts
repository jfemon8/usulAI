import { describe, expect, it } from "vitest";
import {
  contentHash,
  currentEmbeddingModel,
  planIngestion,
  type StoredFingerprint,
} from "@/lib/ingestion/fingerprint";
import type { IngestionDocument } from "@/types";

function document(reference: string, content: string, metadata: Record<string, unknown> = {}) {
  return {
    sourceType: "quran",
    content,
    citation: { sourceType: "quran", reference },
    metadata,
  } satisfies IngestionDocument;
}

function stored(
  id: string,
  reference: string,
  content: string,
  extra: Partial<StoredFingerprint> = {},
): StoredFingerprint {
  return {
    id,
    reference,
    hash: contentHash(content),
    embedded: true,
    citation: { sourceType: "quran", reference },
    metadata: {},
    ...extra,
  };
}

describe("planIngestion", () => {
  it("re-ingesting an identical corpus writes nothing and embeds nothing", () => {
    const plan = planIngestion(
      [document("1:1", "a"), document("1:2", "b")],
      [stored("x1", "1:1", "a"), stored("x2", "1:2", "b")],
    );

    expect(plan).toEqual({
      inserts: [],
      changed: [],
      metadataOnly: [],
      unchanged: 2,
      stale: [],
      duplicates: [],
    });
  });

  it("inserts only the references that are new", () => {
    const plan = planIngestion(
      [document("1:1", "a"), document("1:2", "b")],
      [stored("x1", "1:1", "a")],
    );

    expect(plan.inserts.map((item) => item.citation.reference)).toEqual(["1:2"]);
    expect(plan.unchanged).toBe(1);
  });

  it("marks a reference whose text changed, so only its embedding is redone", () => {
    const plan = planIngestion([document("1:1", "revised")], [stored("x1", "1:1", "original")]);

    expect(plan.changed).toEqual([{ id: "x1", document: document("1:1", "revised") }]);
    expect(plan.inserts).toHaveLength(0);
  });

  it("updates metadata without touching the embedding when only metadata changed", () => {
    const plan = planIngestion(
      [document("1:1", "a", { surahName: "Al-Faatiha" })],
      [stored("x1", "1:1", "a", { metadata: { surahName: "Fatiha" } })],
    );

    expect(plan.metadataOnly.map((item) => item.id)).toEqual(["x1"]);
    expect(plan.changed).toHaveLength(0);
  });

  it("ignores enrichment fields the loader does not produce, like grades and tafsir notes", () => {
    const plan = planIngestion(
      [document("1:1", "a", { surah: 1 })],
      [
        stored("x1", "1:1", "a", {
          metadata: { surah: 1, quranenc: { translation: "..." }, grades: [] },
        }),
      ],
    );

    expect(plan.unchanged).toBe(1);
    expect(plan.metadataOnly).toHaveLength(0);
  });

  it("compares metadata regardless of key order", () => {
    const plan = planIngestion(
      [document("1:1", "a", { surah: 1, ayah: 1 })],
      [stored("x1", "1:1", "a", { metadata: { ayah: 1, surah: 1 } })],
    );

    expect(plan.unchanged).toBe(1);
  });

  it("reports references that vanished from the source as stale", () => {
    const plan = planIngestion(
      [document("1:1", "a")],
      [stored("x1", "1:1", "a"), stored("x9", "9:9", "gone")],
    );

    expect(plan.stale).toEqual(["x9"]);
  });

  it("keeps the embedded copy of a duplicated reference and marks the rest as duplicates", () => {
    const plan = planIngestion(
      [document("1:1", "a")],
      [
        stored("plain", "1:1", "a", { embedded: false }),
        stored("vector", "1:1", "a", { embedded: true }),
        stored("again", "1:1", "a", { embedded: false }),
      ],
    );

    expect(plan.duplicates.sort()).toEqual(["again", "plain"]);
    expect(plan.unchanged).toBe(1);
  });

  it("does not insert the same reference twice when the source repeats it", () => {
    const plan = planIngestion([document("1:1", "a"), document("1:1", "a")], []);

    expect(plan.inserts).toHaveLength(1);
  });
});

describe("fingerprints", () => {
  it("hashes identical text identically and different text differently", () => {
    expect(contentHash("আলহামদু")).toBe(contentHash("আলহামদু"));
    expect(contentHash("আলহামদু")).not.toBe(contentHash("আলহামদু "));
  });

  it("names the embedding model together with its dimensions", () => {
    expect(currentEmbeddingModel()).toBe("gemini-embedding-001@768");
  });
});
