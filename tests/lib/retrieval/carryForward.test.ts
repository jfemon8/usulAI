import { describe, expect, it } from "vitest";
import { mergeCarriedContext, previousSourceReferences } from "@/lib/retrieval/carryForward";
import type { RetrievedChunk, UsulUIMessage } from "@/types";

function chunk(
  id: string,
  sourceType: RetrievedChunk["sourceType"],
  reference: string,
): RetrievedChunk {
  return {
    id,
    sourceType,
    content: "",
    citation: { sourceType, reference },
    similarity: 1,
    retrievedBy: "text",
  };
}

const conversation = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "শেষ জামানায় কোন হাদিসের আমল বিলুপ্ত হবে?" }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      {
        type: "data-sources",
        id: "sources",
        data: [{ index: 1, sourceType: "hadith", reference: "সহীহ বুখারী 7066", similarity: 5.7 }],
      },
      { type: "text", text: "শেষ জামানায় জ্ঞান বিলুপ্ত হবে। [1]" },
    ],
  },
  {
    id: "u2",
    role: "user",
    parts: [
      { type: "text", text: "Shudhu hadiser reference dila but main hadis ta dila na keno?" },
    ],
  },
] as unknown as UsulUIMessage[];

describe("previousSourceReferences", () => {
  it("recovers the sources of the answer the follow-up is asking about", () => {
    expect(previousSourceReferences(conversation)).toEqual(["সহীহ বুখারী 7066"]);
  });

  it("returns nothing on the first turn", () => {
    expect(previousSourceReferences(conversation.slice(0, 1))).toEqual([]);
  });

  it("ignores malformed source parts a client might send", () => {
    const tampered = [
      conversation[0],
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "data-sources", id: "s", data: [{ nope: 1 }, "x", null] }],
      },
      conversation[2],
    ] as unknown as UsulUIMessage[];

    expect(previousSourceReferences(tampered)).toEqual([]);
  });

  it("caps how many earlier sources are carried", () => {
    const many = [
      conversation[0],
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "data-sources",
            id: "s",
            data: Array.from({ length: 9 }, (_, index) => ({ index, reference: `ref ${index}` })),
          },
        ],
      },
      conversation[2],
    ] as unknown as UsulUIMessage[];

    expect(previousSourceReferences(many)).toHaveLength(4);
  });
});

describe("mergeCarriedContext", () => {
  it("keeps the carried source even when the new search found nothing, which was the screenshot's failure", () => {
    const carried = [chunk("h1", "hadith", "সহীহ বুখারী 7066")];

    expect(mergeCarriedContext([], carried)).toEqual(carried);
  });

  it("does not duplicate a source found both ways", () => {
    const shared = chunk("h1", "hadith", "সহীহ বুখারী 7066");

    expect(mergeCarriedContext([shared], [shared])).toHaveLength(1);
  });

  it("orders the merged context by source priority", () => {
    const merged = mergeCarriedContext(
      [chunk("q1", "quran", "Al-Baqara 2:275")],
      [chunk("h1", "hadith", "সহীহ বুখারী 7066")],
    );

    expect(merged.map((item) => item.sourceType)).toEqual(["quran", "hadith"]);
  });

  it("never exceeds the context budget", () => {
    const retrieved = Array.from({ length: 12 }, (_, index) =>
      chunk(`r${index}`, "hadith", `r ${index}`),
    );
    const carried = [chunk("c1", "hadith", "carried")];

    const merged = mergeCarriedContext(retrieved, carried, 12);

    expect(merged).toHaveLength(12);
    expect(merged.some((item) => item.id === "c1")).toBe(true);
  });
});
