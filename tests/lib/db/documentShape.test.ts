import { describe, expect, it } from "vitest";
import { OPENITI_CONFIG } from "@/config/site";
import {
  chapterFromReference,
  decodeGrades,
  encodeGrades,
  hydrateCitation,
  hydrateMetadata,
  referenceFilters,
  storedCitation,
  storedMetadata,
} from "@/lib/db/documentShape";
import { buildSourceContent } from "@/lib/ingestion/translations";

const book = OPENITI_CONFIG.fiqh.find((entry) => entry.slug === "ibn-abidin-radd-al-muhtar")!;
const fileName = `${book.slug}.md`;
const chapter = "ما يبطل بالشرط الفاسد ولا يصح تعليقه به";
const reference = `${book.title}, ${chapter}, খণ্ড 5, পৃষ্ঠা 240, অংশ 5`;
const metadata = { fileName, chapter, volume: 5, page: 240 };

describe("book references and chapters", () => {
  it("stores the reference without the book title and restores it on read", () => {
    const stored = storedCitation(
      { reference, sourceType: "fiqh", url: null } as never,
      "fiqh",
      metadata,
    );

    expect(stored.reference).toBe(`${chapter}, খণ্ড 5, পৃষ্ঠা 240, অংশ 5`);
    expect("url" in stored).toBe(false);
    expect(hydrateCitation(stored, "fiqh", metadata).reference).toBe(reference);
  });

  it("drops a chapter the reference already carries and restores it on read", () => {
    const stored = storedMetadata(metadata, "fiqh", reference);

    expect(stored.chapter).toBeUndefined();
    expect(hydrateMetadata(stored, `${chapter}, খণ্ড 5, পৃষ্ঠা 240, অংশ 5`).chapter).toBe(chapter);
    expect(chapterFromReference(reference, metadata)).toBe(chapter);
  });

  it("keeps a chapter that the reference shortened", () => {
    const long = "ب".repeat(300);
    const shortened = `${book.title}, ${"ب".repeat(120)}…, পৃষ্ঠা 3`;
    expect(storedMetadata({ fileName, chapter: long }, "fiqh", shortened).chapter).toBe(long);
  });

  it("leaves books without a known title untouched", () => {
    const privateBook = { fileName: "private-book.md", restricted: true, chapter: "অধ্যায়" };
    const privateReference = "হৃদয়ের বাদশাহ, অধ্যায়, পৃষ্ঠা 4";

    expect(
      storedCitation({ reference: privateReference } as never, "sirat", privateBook).reference,
    ).toBe(privateReference);
    expect(storedMetadata(privateBook, "sirat", privateReference).chapter).toBe("অধ্যায়");
  });

  it("queries both the stored suffix and a not yet compacted full reference", () => {
    const filters = referenceFilters([reference, "Al-Baqara 2:255"]);

    expect(filters).toContainEqual({
      "citation.reference": { $in: [reference, "Al-Baqara 2:255"] },
    });
    expect(filters).toContainEqual({
      "metadata.fileName": fileName,
      "citation.reference": { $in: [`${chapter}, খণ্ড 5, পৃষ্ঠা 240, অংশ 5`] },
    });
  });
});

describe("hadith grades", () => {
  const grades = [
    { name: "Al-Albani", grade: "Hasan Sahih" },
    { name: "Someone New", grade: "Da'if | weak" },
  ];

  it("encodes known graders as short codes and decodes both forms", () => {
    const encoded = encodeGrades(grades);

    expect(encoded).toEqual(["0|Hasan Sahih", "Someone New|Da'if | weak"]);
    expect(decodeGrades(encoded)).toEqual(grades);
    expect(decodeGrades(grades)).toEqual(grades);
    expect(storedMetadata({ grades }, "hadith").grades).toEqual(encoded);
    expect(hydrateMetadata({ grades: encoded }).grades).toEqual(grades);
  });
});

describe("directional marks", () => {
  it("are not stored in source text", () => {
    const content = buildSourceContent("قَالَ \u200F.\u200F", "বাংলা", "English");
    expect(content).not.toMatch(/[\u200E\u200F]/);
    expect(content.startsWith("قَالَ .")).toBe(true);
  });
});
