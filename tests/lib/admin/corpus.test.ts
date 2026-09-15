import { BSON, Binary } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  buildCorpusUpdate,
  buildStoredDocument,
  citationFieldsFor,
  cleanCorpusContent,
  contentPreview,
  hashHex,
  isObjectIdString,
  parseCitationFields,
  parseMetadataJson,
  referenceCandidates,
  serializeMetadata,
} from "@/lib/admin/corpus";
import { AdminError } from "@/lib/admin/http";
import { contentHash } from "@/lib/ingestion/fingerprint";
import { storedContentHash } from "@/lib/retrieval/vectorStore";
import type { CorpusEditPayload } from "@/components/admin/corpus/types";

const now = new Date("2026-09-15T10:00:00Z");
const LRM = "\u200E";
const RLM = "\u200F";

function payload(overrides: Partial<CorpusEditPayload> = {}): CorpusEditPayload {
  return {
    sourceType: "hadith",
    reference: "সহীহ বুখারী 1454",
    content: "text",
    citation: [],
    metadata: "{}",
    ...overrides,
  };
}

describe("content and search helpers", () => {
  it("strips directional marks and normalises line endings like ingestion", () => {
    expect(cleanCorpusContent(`  ${RLM}قال${LRM}\r\nবাংলা: কথা\r ${LRM}`)).toBe("قال\nবাংলা: কথা");
  });

  it("recognises an ObjectId string only when it is exactly 24 hex characters", () => {
    expect(isObjectIdString("65f1a2b3c4d5e6f708192a3b")).toBe(true);
    expect(isObjectIdString(" 65F1A2B3C4D5E6F708192A3B ")).toBe(true);
    expect(isObjectIdString("সহীহ বুখারী 1454")).toBe(false);
    expect(isObjectIdString("65f1a2b3c4d5e6f708192a3")).toBe(false);
  });

  it("previews at most the configured characters with whitespace collapsed", () => {
    expect(contentPreview("a\n\n  b", 160)).toBe("a b");
    expect(contentPreview("আলহামদু লিল্লাহ", 4)).toBe("আলহা…");
  });

  it("reads a content hash stored as Binary or as legacy hex", () => {
    const hex = contentHash("text");
    expect(hashHex(storedContentHash("text"))).toBe(hex);
    expect(hashHex(hex)).toBe(hex);
    expect(hashHex(undefined)).toBeNull();
  });
});

describe("citation fields", () => {
  it("lists every scalar citation key except reference and source type", () => {
    expect(
      citationFieldsFor({
        sourceType: "quran",
        reference: "Al-Faatiha 1:2",
        url: "https://quran.com/1/2",
        page: 3,
      }),
    ).toEqual([
      { key: "url", value: "https://quran.com/1/2" },
      { key: "page", value: "3" },
    ]);
  });

  it("types page numbers, validates urls and media, and skips empty values", () => {
    expect(
      parseCitationFields([
        { key: "page", value: " 12 " },
        { key: "url", value: "https://example.org/a.pdf#page=4" },
        { key: "media", value: "pdf" },
        { key: "note", value: "" },
        { key: "", value: "" },
      ]),
    ).toEqual({ page: 12, url: "https://example.org/a.pdf#page=4", media: "pdf" });
  });

  it("rejects reserved, malformed, duplicate and invalid fields", () => {
    expect(() => parseCitationFields([{ key: "reference", value: "x" }])).toThrow(AdminError);
    expect(() => parseCitationFields([{ key: "a.b", value: "x" }])).toThrow(AdminError);
    expect(() =>
      parseCitationFields([
        { key: "url", value: "https://a.org" },
        { key: "url", value: "https://b.org" },
      ]),
    ).toThrow(AdminError);
    expect(() => parseCitationFields([{ key: "page", value: "0" }])).toThrow(AdminError);
    expect(() => parseCitationFields([{ key: "url", value: "javascript:alert(1)" }])).toThrow(
      AdminError,
    );
    expect(() => parseCitationFields([{ key: "media", value: "video" }])).toThrow(AdminError);
  });
});

describe("metadata JSON", () => {
  it("round-trips dates and hides the admin stamp fields from the editor", () => {
    const text = serializeMetadata({
      page: 4,
      retrievedAt: now,
      adminEdited: true,
      adminEditedAt: now,
    });
    expect(text).not.toContain("adminEdited");
    expect(parseMetadataJson(text)).toEqual({ page: 4, retrievedAt: now });
  });

  it("accepts an empty editor as empty metadata", () => {
    expect(parseMetadataJson("   ")).toEqual({});
  });

  it("rejects arrays, invalid JSON and keys MongoDB cannot store", () => {
    expect(() => parseMetadataJson("[1]")).toThrow(AdminError);
    expect(() => parseMetadataJson("{ page: 1 }")).toThrow(AdminError);
    expect(() => parseMetadataJson('{"a.b": 1}')).toThrow(AdminError);
    expect(() => parseMetadataJson('{"nested": {"$where": "x"}}')).toThrow(AdminError);
  });
});

describe("buildStoredDocument", () => {
  it("compacts a book citation and metadata exactly like ingestion stores them", () => {
    const stored = buildStoredDocument(
      payload({
        sourceType: "fiqh",
        reference: "মুখতাসারুল কুদূরী (ইমাম কুদূরী), باب صلاة الجمعة, পৃষ্ঠা 40",
        content: `${RLM}text`,
        citation: [
          { key: "page", value: "40" },
          {
            key: "url",
            value:
              "https://res.cloudinary.com/demo/raw/upload/v1/raw-sources/fiqh/quduri-al-mukhtasar.md",
          },
        ],
        metadata: BSON.EJSON.stringify({
          fileName: "quduri-al-mukhtasar.md",
          page: 40,
          chapter: "باب صلاة الجمعة",
          storageKey: "raw-sources/fiqh/quduri-al-mukhtasar.md",
        }),
      }),
      { now },
    );

    expect(stored.content).toBe("text");
    expect(stored.contentHash).toEqual(storedContentHash("text"));
    expect(stored.citation).toEqual({ reference: "باب صلاة الجمعة, পৃষ্ঠা 40" });
    expect(stored.metadata).toEqual({
      fileName: "quduri-al-mukhtasar.md",
      page: 40,
      adminEdited: true,
      adminEditedAt: now,
    });
    expect(stored.reference).toBe("মুখতাসারুল কুদূরী (ইমাম কুদূরী), باب صلاة الجمعة, পৃষ্ঠা 40");
  });

  it("drops a derivable quran.com link and encodes hadith grades", () => {
    const quran = buildStoredDocument(
      payload({
        sourceType: "quran",
        reference: "Al-Faatiha 1:2",
        citation: [{ key: "url", value: "https://quran.com/1/2" }],
        metadata: '{"surah": 1, "ayah": 2}',
      }),
      { now },
    );
    expect(quran.citation).toEqual({ reference: "Al-Faatiha 1:2" });

    const hadith = buildStoredDocument(
      payload({ metadata: '{"grades": [{"name": "Al-Albani", "grade": "Sahih"}]}' }),
      { now },
    );
    expect(hadith.metadata.grades).toEqual(["0|Sahih"]);
  });

  it("keeps the stored restricted flag on update regardless of the editor", () => {
    const unlocked = buildStoredDocument(payload({ metadata: '{"restricted": true}' }), {
      now,
      restricted: false,
    });
    expect(unlocked.metadata.restricted).toBeUndefined();

    const locked = buildStoredDocument(payload({ metadata: "{}" }), { now, restricted: true });
    expect(locked.metadata.restricted).toBe(true);
  });

  it("ignores admin stamps typed into the editor and always stamps the edit", () => {
    const stored = buildStoredDocument(
      payload({ metadata: '{"adminEdited": false, "adminEditedAt": "yesterday"}' }),
      { now },
    );
    expect(stored.metadata).toEqual({ adminEdited: true, adminEditedAt: now });
  });

  it("refuses an empty reference or empty content", () => {
    expect(() => buildStoredDocument(payload({ reference: `  ${LRM} ` }), { now })).toThrow(
      AdminError,
    );
    expect(() => buildStoredDocument(payload({ content: `\n${RLM}\n` }), { now })).toThrow(
      AdminError,
    );
  });
});

describe("buildCorpusUpdate", () => {
  const stored = buildStoredDocument(payload({ content: "new text" }), { now });

  it("clears the embedding and rewrites the hash when the content changed", () => {
    const { update, contentChanged } = buildCorpusUpdate(
      { content: "old text", contentHash: storedContentHash("old text") },
      stored,
    );

    expect(contentChanged).toBe(true);
    expect(update.$set.content).toBe("new text");
    expect(update.$set.contentHash).toEqual(storedContentHash("new text"));
    expect(update.$unset).toEqual({ embedding: "", embeddingModel: "" });
  });

  it("keeps the embedding when only citation or metadata changed", () => {
    const { update, contentChanged } = buildCorpusUpdate(
      { content: "new text", contentHash: storedContentHash("new text") },
      stored,
    );

    expect(contentChanged).toBe(false);
    expect(update.$unset).toBeUndefined();
    expect(update.$set).not.toHaveProperty("content");
    expect(update.$set.metadata).toEqual(stored.metadata);
    expect(update.$set.citation).toEqual(stored.citation);
  });

  it("fills in a missing hash without touching the embedding", () => {
    const { update } = buildCorpusUpdate({ content: "new text" }, stored);
    expect(update.$set.contentHash).toBeInstanceOf(Binary);
    expect(update.$unset).toBeUndefined();
  });
});

describe("referenceCandidates", () => {
  it("checks both the full and the compacted form of a book reference", () => {
    expect(
      referenceCandidates("মুখতাসারুল কুদূরী (ইমাম কুদূরী), باب صلاة الجمعة, পৃষ্ঠা 40", {
        fileName: "quduri-al-mukhtasar.md",
      }),
    ).toEqual([
      "মুখতাসারুল কুদূরী (ইমাম কুদূরী), باب صلاة الجمعة, পৃষ্ঠা 40",
      "باب صلاة الجمعة, পৃষ্ঠা 40",
    ]);
    expect(referenceCandidates("সহীহ বুখারী 1454", {})).toEqual(["সহীহ বুখারী 1454"]);
  });
});
