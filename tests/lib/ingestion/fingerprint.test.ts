import { describe, expect, it } from "vitest";
import {
  contentHash,
  currentEmbeddingModel,
  planIngestion,
  type StoredFingerprint,
} from "@/lib/ingestion/fingerprint";
import { hydrateCitation, storedCitation, storedMetadata } from "@/lib/db/documentShape";
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
    citation: { reference },
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

  it("never prunes a private book whose file is simply absent from this machine", () => {
    const plan = planIngestion(
      [document("s:1", "a", { fileName: "public.md" })],
      [
        stored("x1", "s:1", "a", { metadata: { fileName: "public.md" } }),
        stored("x2", "p:1", "private", { metadata: { fileName: "rahiq.pdf", restricted: true } }),
        stored("x3", "s:2", "old", { metadata: { fileName: "public.md" } }),
      ],
    );

    expect(plan.stale).toEqual(["x3"]);
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

  it("never overwrites a document an admin edited, whether its text or metadata differ", () => {
    const plan = planIngestion(
      [document("1:1", "loader text"), document("1:2", "b", { surahName: "Loader" })],
      [
        stored("x1", "1:1", "admin text", { metadata: { adminEdited: true } }),
        stored("x2", "1:2", "b", { metadata: { surahName: "Admin", adminEdited: true } }),
      ],
    );

    expect(plan.changed).toHaveLength(0);
    expect(plan.metadataOnly).toHaveLength(0);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.unchanged).toBe(2);
  });

  it("never prunes an admin edited or admin created document missing from the source", () => {
    const plan = planIngestion(
      [document("1:1", "a")],
      [
        stored("x1", "1:1", "a"),
        stored("admin", "9:9", "added by admin", { metadata: { adminEdited: true } }),
        stored("gone", "9:10", "gone"),
      ],
    );

    expect(plan.stale).toEqual(["gone"]);
  });

  it("still plans ordinary changes beside an admin edited document", () => {
    const plan = planIngestion(
      [document("1:1", "revised"), document("1:2", "loader")],
      [
        stored("x1", "1:1", "original"),
        stored("x2", "1:2", "admin", { metadata: { adminEdited: false } }),
      ],
    );

    expect(plan.changed.map((item) => item.id)).toEqual(["x1", "x2"]);
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

describe("the stored document shape", () => {
  const book: IngestionDocument = {
    sourceType: "fiqh",
    content: "text",
    citation: {
      sourceType: "fiqh",
      reference: "মুখতাসারুল কুদূরী, باب صلاة الجمعة, পৃষ্ঠা 40",
      url: "https://res.cloudinary.com/demo/raw/upload/v1/raw-sources/fiqh/quduri.md?_a=BAMAROLW0",
      page: 40,
    },
    metadata: { fileName: "quduri.md", page: 40, storageKey: "raw-sources/fiqh/quduri.md" },
  };

  it("stores neither the fields a reader can rebuild nor the archive key", () => {
    expect(storedCitation(book.citation, book.sourceType, book.metadata)).toEqual({
      reference: book.citation.reference,
    });
    expect(storedMetadata(book.metadata ?? {}, book.sourceType)).toEqual({
      fileName: "quduri.md",
      page: 40,
    });
  });

  it("treats a compacted stored book as unchanged when the loader rebuilds the full citation", () => {
    const plan = planIngestion(
      [book],
      [
        {
          id: "b1",
          reference: book.citation.reference,
          hash: contentHash("text"),
          embedded: false,
          citation: { reference: book.citation.reference },
          metadata: { fileName: "quduri.md", page: 40 },
        },
      ],
    );

    expect(plan.unchanged).toBe(1);
    expect(plan.metadataOnly).toHaveLength(0);
  });

  it("keeps a private book's archive key and a PDF's page link", () => {
    const privateMetadata = {
      fileName: "p.pdf",
      page: 3,
      restricted: true,
      storageKey: "raw-sources/sirat/p.pdf",
    };
    const pdfCitation = {
      sourceType: "sirat" as const,
      reference: "r",
      url: "https://res.cloudinary.com/demo/raw/upload/v1/raw-sources/sirat/b.pdf#page=5",
      page: 3,
    };

    expect(storedMetadata(privateMetadata, "sirat")).toEqual(privateMetadata);
    expect(storedCitation(pdfCitation, "sirat", { fileName: "b.pdf", page: 3 })).toEqual({
      reference: "r",
      url: pdfCitation.url,
    });
  });

  it("rebuilds the source type, page and quran.com link when reading", () => {
    expect(
      hydrateCitation({ reference: "Al-Faatiha 1:2" }, "quran", { surah: 1, ayah: 2 }),
    ).toEqual({
      reference: "Al-Faatiha 1:2",
      sourceType: "quran",
      url: "https://quran.com/1/2",
    });
    expect(hydrateCitation({ reference: "x" }, "fiqh", { page: 40 })).toEqual({
      reference: "x",
      sourceType: "fiqh",
      page: 40,
    });
  });
});
