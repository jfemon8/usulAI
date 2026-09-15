import { BSON, Binary, Long, ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  assertBulkDeleteAllowed,
  assertCollectionName,
  changedTopLevelKeys,
  documentRevision,
  documentView,
  idToText,
  parseDocumentText,
  parseFilterText,
  parseIdText,
  parseOffset,
  parsePage,
  parseSort,
  restoreBinaries,
  sameId,
  summarizeDocument,
  toEditableValue,
  valueAtPointer,
} from "@/lib/admin/database";
import { AdminError } from "@/lib/admin/http";
import {
  documentApiPath,
  lineColumnAt,
  locateJsonError,
  offsetAt,
} from "@/components/admin/database/jsonText";

function statusOf(run: () => unknown): number | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof AdminError ? error.status : -1;
  }
}

describe("collection names", () => {
  it("accepts app collections", () => {
    expect(assertCollectionName("documents")).toBe("documents");
    expect(assertCollectionName("query_logs")).toBe("query_logs");
  });

  it("rejects protected, system and malformed names", () => {
    expect(statusOf(() => assertCollectionName("admin_accounts"))).toBe(403);
    expect(statusOf(() => assertCollectionName("admin_sessions"))).toBe(403);
    expect(statusOf(() => assertCollectionName("admin_reset_tokens"))).toBe(403);
    expect(statusOf(() => assertCollectionName("system.profile"))).toBe(403);
    expect(statusOf(() => assertCollectionName("a/b"))).toBe(400);
    expect(statusOf(() => assertCollectionName(""))).toBe(400);
    expect(statusOf(() => assertCollectionName("x".repeat(121)))).toBe(400);
  });
});

describe("filters", () => {
  it("parses empty and Extended JSON filters", () => {
    expect(parseFilterText("")).toEqual({});
    expect(parseFilterText("  ")).toEqual({});
    expect(parseFilterText('{"sourceType":"quran"}')).toEqual({ sourceType: "quran" });
    const byId = parseFilterText('{"_id":{"$oid":"64b7f0a1c2d3e4f5a6b7c8d9"}}');
    expect(byId._id).toBeInstanceOf(ObjectId);
  });

  it("allows field operators and logical operators", () => {
    expect(() =>
      parseFilterText('{"$or":[{"a":{"$gt":1}},{"b":{"$in":["x","y"]}}],"c":{"$exists":true}}'),
    ).not.toThrow();
    expect(() => parseFilterText('{"$and":[{"$nor":[{"a":1}]}]}')).not.toThrow();
  });

  it("rejects dangerous or unsupported operators", () => {
    expect(statusOf(() => parseFilterText('{"$where":"sleep(1000)"}'))).toBe(400);
    expect(statusOf(() => parseFilterText('{"$expr":{"$eq":["$a","$b"]}}'))).toBe(400);
    expect(
      statusOf(() =>
        parseFilterText('{"$and":[{"$expr":{"$function":{"body":"x","args":[],"lang":"js"}}}]}'),
      ),
    ).toBe(400);
    expect(statusOf(() => parseFilterText('{"a":{"$elemMatch":{"$where":"1"}}}'))).toBe(400);
    expect(statusOf(() => parseFilterText('{"a":{"$accumulator":{}}}'))).toBe(400);
    expect(statusOf(() => parseFilterText('{"$text":{"$search":"x"}}'))).toBe(400);
    expect(statusOf(() => parseFilterText('{"$or":{"a":1}}'))).toBe(400);
    expect(statusOf(() => parseFilterText('{"$or":[]}'))).toBe(400);
  });

  it("rejects non-object and invalid JSON", () => {
    expect(statusOf(() => parseFilterText("[1]"))).toBe(400);
    expect(statusOf(() => parseFilterText('"x"'))).toBe(400);
    expect(statusOf(() => parseFilterText("{a:1}"))).toBe(400);
  });
});

describe("sort and page", () => {
  it("defaults to _id descending and adds an _id tiebreaker", () => {
    expect(parseSort(null, null)).toEqual({ _id: -1 });
    expect(parseSort("_id", "asc")).toEqual({ _id: 1 });
    expect(parseSort("citation.reference", "asc")).toEqual({ "citation.reference": 1, _id: 1 });
    expect(statusOf(() => parseSort("$where", "asc"))).toBe(400);
  });

  it("clamps page numbers", () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("99999999")).toBe(50_000);
  });

  it("clamps offsets for continuous loading", () => {
    expect(parseOffset(null)).toBe(0);
    expect(parseOffset("-5")).toBe(0);
    expect(parseOffset("1.5")).toBe(0);
    expect(parseOffset("abc")).toBe(0);
    expect(parseOffset("40", 20)).toBe(40);
    expect(parseOffset("99999999999", 20)).toBe(49_999 * 20);
  });
});

describe("ids", () => {
  it("round-trips ObjectId, string, number and Long ids", () => {
    const objectId = new ObjectId();
    expect(sameId(parseIdText(idToText(objectId)), objectId)).toBe(true);
    expect(parseIdText(idToText("quran:1"))).toBe("quran:1");
    expect(sameId(parseIdText(idToText(42)), 42)).toBe(true);
    const long = Long.fromString("9007199254740993");
    const parsed = parseIdText(idToText(long));
    expect(Long.isLong(parsed)).toBe(true);
    expect(String(parsed)).toBe("9007199254740993");
  });

  it("keeps string and ObjectId ids distinct", () => {
    const objectId = new ObjectId();
    expect(sameId(parseIdText(idToText(objectId.toHexString())), objectId)).toBe(false);
  });

  it("rejects operators, arrays and empty ids", () => {
    expect(statusOf(() => parseIdText(""))).toBe(400);
    expect(statusOf(() => parseIdText(null))).toBe(400);
    expect(statusOf(() => parseIdText('{"$gt":1}'))).toBe(400);
    expect(statusOf(() => parseIdText("[1]"))).toBe(400);
    expect(statusOf(() => parseIdText("null"))).toBe(400);
  });
});

describe("binary placeholders", () => {
  const original = {
    _id: new ObjectId(),
    content: "text",
    embedding: new Binary(Buffer.alloc(3072, 7), 9),
    metadata: { hashes: [new Binary(Buffer.alloc(32, 1), 0)], "a/b": new Binary(Buffer.from("x")) },
  };

  it("replaces binaries with placeholders and lists them", () => {
    const binaries: { path: string; subtype: number; bytes: number }[] = [];
    const editable = toEditableValue(original, binaries) as Record<string, unknown>;
    expect(editable.embedding).toEqual({ $binaryRef: "/embedding", subtype: 9, bytes: 3072 });
    expect(binaries.map((binary) => binary.path)).toEqual([
      "/embedding",
      "/metadata/hashes/0",
      "/metadata/a~1b",
    ]);
    expect(valueAtPointer(original, "/metadata/a~1b")).toBe(original.metadata["a/b"]);
  });

  it("restores unchanged placeholders after an edit round trip", () => {
    const view = documentView(original);
    expect(view.text).not.toContain("AAAA");
    const edited = view.text.replace('"text"', '"changed"');
    const next = parseDocumentText(edited, original);
    expect(next.content).toBe("changed");
    expect(next.embedding).toBe(original.embedding);
    expect(next.metadata.hashes[0]).toBe(original.metadata.hashes[0]);
    expect(next.metadata["a/b"]).toBe(original.metadata["a/b"]);
    expect(changedTopLevelKeys(original, next)).toEqual(["content"]);
  });

  it("accepts an explicitly replaced binary", () => {
    const view = documentView(original);
    const edited = view.text.replace(
      /\{\s*"\$binaryRef": "\/embedding",\s*"subtype": 9,\s*"bytes": 3072\s*\}/,
      '{"$binary":{"base64":"AQI=","subType":"00"}}',
    );
    const next = parseDocumentText(edited, original);
    expect(next.embedding).toBeInstanceOf(Binary);
    expect((next.embedding as Binary).length()).toBe(2);
  });

  it("rejects placeholders on insert or with a wrong path", () => {
    expect(statusOf(() => restoreBinaries({ a: { $binaryRef: "/embedding" } }, null))).toBe(400);
    expect(statusOf(() => restoreBinaries({ a: { $binaryRef: "/content" } }, original))).toBe(400);
    expect(statusOf(() => restoreBinaries({ a: { $binaryRef: "embedding" } }, original))).toBe(400);
  });
});

describe("document text", () => {
  it("preserves Date, ObjectId and Long through the editor format", () => {
    const doc = {
      _id: new ObjectId(),
      at: new Date("2026-09-01T10:00:00Z"),
      big: Long.fromString("9007199254740993"),
      ratio: 0.5,
    };
    const view = documentView(doc);
    const parsed = parseDocumentText(view.text, doc);
    expect(parsed._id).toBeInstanceOf(ObjectId);
    expect(parsed.at).toBeInstanceOf(Date);
    expect(String(parsed.big)).toBe("9007199254740993");
    expect(changedTopLevelKeys(doc, parsed)).toEqual([]);
    expect(BSON.calculateObjectSize(parsed)).toBe(BSON.calculateObjectSize(doc));
  });

  it("rejects arrays, dollar keys and invalid JSON", () => {
    expect(statusOf(() => parseDocumentText("[]", null))).toBe(400);
    expect(statusOf(() => parseDocumentText('{"$set":{"a":1}}', null))).toBe(400);
    expect(statusOf(() => parseDocumentText('{"a":{"$inc":1}}', null))).toBe(400);
    expect(statusOf(() => parseDocumentText("{", null))).toBe(400);
  });

  it("rejects documents over the size limit", () => {
    const text = JSON.stringify({ a: "x".repeat(2_100_000) });
    expect(statusOf(() => parseDocumentText(text, null))).toBe(413);
  });

  it("changes the revision when the document changes", () => {
    const doc = { _id: "a", n: 1 };
    expect(documentRevision(doc)).toBe(documentRevision({ _id: "a", n: 1 }));
    expect(documentRevision(doc)).not.toBe(documentRevision({ _id: "a", n: 2 }));
  });
});

describe("bulk delete guard", () => {
  it("requires the typed collection name", () => {
    expect(
      statusOf(() => assertBulkDeleteAllowed("query_logs", { a: 1 }, "query_log", false)),
    ).toBe(400);
    expect(
      statusOf(() => assertBulkDeleteAllowed("query_logs", { a: 1 }, "query_logs", false)),
    ).toBe(null);
  });

  it("refuses an empty filter without confirmAll", () => {
    expect(statusOf(() => assertBulkDeleteAllowed("documents", {}, "documents", false))).toBe(400);
    expect(statusOf(() => assertBulkDeleteAllowed("quran_notes", {}, "quran_notes", false))).toBe(
      400,
    );
    expect(statusOf(() => assertBulkDeleteAllowed("documents", {}, "documents", true))).toBe(null);
  });
});

describe("row summaries", () => {
  it("shows the first scalar fields, flattening nested objects and skipping binaries", () => {
    const summary = summarizeDocument({
      _id: new ObjectId("64b7f0a1c2d3e4f5a6b7c8d9"),
      embedding: new Binary(Buffer.alloc(10)),
      sourceType: "quran",
      content: `${"ক".repeat(100)}\n\nmore`,
      citation: { reference: "Al-Baqara 2:255" },
      tags: ["a"],
      metadata: { surah: 2, ayah: 255 },
    });
    expect(summary.id).toBe('{"$oid":"64b7f0a1c2d3e4f5a6b7c8d9"}');
    expect(summary.binaries).toBe(1);
    expect(summary.fields.map((field) => field.key)).toEqual([
      "sourceType",
      "content",
      "citation.reference",
      "metadata.surah",
    ]);
    expect(summary.fields[1]?.value.endsWith("…")).toBe(true);
    expect(summary.bytes).toBeGreaterThan(0);
  });
});

describe("client JSON helpers", () => {
  it("locates parse errors by line and column", () => {
    const text = '{\n  "a": 1,\n}';
    const problem = locateJsonError(text);
    expect(problem).not.toBeNull();
    expect(problem?.line).toBe(3);
    expect(problem?.offset).toBe(offsetAt(text, 3, 1));
    expect(lineColumnAt(text, problem?.offset ?? 0)).toEqual({ line: 3, column: 1 });
  });

  it("requires an object and handles empty input", () => {
    expect(locateJsonError("[]")?.message).toBeTruthy();
    expect(locateJsonError("", { allowEmpty: true })).toBeNull();
    expect(locateJsonError("")).not.toBeNull();
    expect(locateJsonError('{"a":{"$oid":"x"}}')).toBeNull();
  });

  it("encodes the id into the document path", () => {
    expect(documentApiPath("query_logs", '{"$oid":"abc"}')).toBe(
      "/api/admin/database/query_logs/document?id=%7B%22%24oid%22%3A%22abc%22%7D",
    );
  });
});
