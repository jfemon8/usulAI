import { describe, expect, it } from "vitest";
import { definitionMatches } from "@/lib/db/setupIndexes";

const desired = {
  mappings: {
    dynamic: false,
    fields: {
      content: { type: "string", analyzer: "lucene.bengali" },
      sourceType: { type: "token" },
    },
  },
};

describe("definitionMatches", () => {
  it("treats the live definition as unchanged even when Atlas adds its own defaults", () => {
    const live = {
      analyzer: "lucene.standard",
      searchAnalyzer: "lucene.standard",
      mappings: {
        dynamic: false,
        fields: {
          content: { type: "string", analyzer: "lucene.bengali", indexOptions: "offsets" },
          sourceType: { type: "token", normalizer: "none" },
        },
      },
    };

    expect(definitionMatches(desired, live)).toBe(true);
  });

  it("detects a changed analyzer, which is worth a rebuild", () => {
    const live = structuredClone(desired);
    live.mappings.fields.content.analyzer = "lucene.standard";

    expect(definitionMatches(desired, live)).toBe(false);
  });

  it("detects a changed vector dimension", () => {
    const vector = { fields: [{ type: "vector", path: "embedding", numDimensions: 768 }] };

    expect(
      definitionMatches(vector, {
        fields: [{ type: "vector", path: "embedding", numDimensions: 3072 }],
      }),
    ).toBe(false);
  });

  it("detects a field added to or removed from a vector index", () => {
    const vector = { fields: [{ type: "vector" }, { type: "filter", path: "sourceType" }] };

    expect(definitionMatches(vector, { fields: [{ type: "vector" }] })).toBe(false);
  });

  it("rebuilds when there is no live definition to compare against", () => {
    expect(definitionMatches(desired, undefined)).toBe(false);
  });
});
