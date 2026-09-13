import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  formatBookReference,
  sectionsFromHtml,
  sectionsFromPdfPages,
  sectionsFromPlainText,
} from "@/lib/ingestion/sources/bookStructure";

vi.mock("@/lib/storage", () => ({
  uploadRawDocument: vi.fn(),
  getRawDocumentUrl: (key: string) => `https://cdn.example/${key}`,
}));

const { loadFileDocuments } = await import("@/lib/ingestion/sources/fileSource");

function minimalPdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((text, index) => {
    const pageId = 4 + index * 2;
    const stream = text ? `BT /F1 18 Tf 72 700 Td (${text}) Tj ET` : "";
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xref = body.length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return Buffer.from(body, "latin1");
}

describe("sectionsFromPlainText", () => {
  it("tracks chapters from headings and pages from page markers", () => {
    const sections = sectionsFromPlainText(
      "# প্রথম অধ্যায়: ইজমার সংজ্ঞা\n[পৃষ্ঠা ১২]\nইজমা হলো মুজতাহিদদের ঐক্যমত।\n[পৃষ্ঠা ১৩]\nএটি শরীয়তের দলিল।\n## দ্বিতীয় অধ্যায়\nইজমার প্রকারভেদ।",
    );

    expect(sections).toEqual([
      { text: "ইজমা হলো মুজতাহিদদের ঐক্যমত।", chapter: "প্রথম অধ্যায়: ইজমার সংজ্ঞা", page: 12 },
      { text: "এটি শরীয়তের দলিল।", chapter: "প্রথম অধ্যায়: ইজমার সংজ্ঞা", page: 13 },
      { text: "ইজমার প্রকারভেদ।", chapter: "দ্বিতীয় অধ্যায়", page: 13 },
    ]);
  });

  it("treats a form feed as the next page", () => {
    const sections = sectionsFromPlainText("page 5\nএক\fদুই");
    expect(sections.map((section) => section.page)).toEqual([5, 6]);
  });
});

describe("sectionsFromHtml", () => {
  it("reads docx headings as chapters", () => {
    const sections = sectionsFromHtml(
      "<h1>কিয়াসের রুকন</h1><p>আসল, ফারা, হুকুম ও ইল্লাত।</p><h2>ইল্লাত</h2><p>যে কারণে হুকুম দেওয়া হয়&amp;যা মিলতে হয়।</p>",
    );

    expect(sections).toEqual([
      { text: "আসল, ফারা, হুকুম ও ইল্লাত।", chapter: "কিয়াসের রুকন", page: undefined },
      { text: "যে কারণে হুকুম দেওয়া হয়&যা মিলতে হয়।", chapter: "ইল্লাত", page: undefined },
    ]);
  });
});

describe("sectionsFromPdfPages", () => {
  it("maps printed page numbers and chapter starts, and reports pages with no text layer", () => {
    const report = sectionsFromPdfPages(
      [
        "Cover title page with text",
        "   ",
        "Body of the first chapter",
        "More of the first chapter continues here",
      ],
      { pageOffset: -2, chapters: [{ title: "প্রথম অধ্যায়", page: 1 }] },
    );

    expect(report.blankPages).toEqual([2]);
    expect(report.sections.map(({ page, chapter }) => ({ page, chapter }))).toEqual([
      { page: -1, chapter: undefined },
      { page: 1, chapter: "প্রথম অধ্যায়" },
      { page: 2, chapter: "প্রথম অধ্যায়" },
    ]);
  });
});

describe("formatBookReference", () => {
  it("cites book, chapter and page", () => {
    expect(
      formatBookReference({ title: "আল-ইজমা", chapter: "ইবাদত", page: 42, part: 1, partCount: 1 }),
    ).toBe("আল-ইজমা, ইবাদত, পৃষ্ঠা 42");
  });

  it("adds the part only when a page was split", () => {
    expect(formatBookReference({ title: "আল-ইজমা", page: 42, part: 2, partCount: 3 })).toBe(
      "আল-ইজমা, পৃষ্ঠা 42, অংশ 2",
    );
  });

  it("falls back to parts when the book has no structure at all", () => {
    expect(formatBookReference({ title: "নোট", part: 3, partCount: 5 })).toBe("নোট, অংশ 3");
  });
});

describe("loadFileDocuments", () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "usul-books-"));
    await writeFile(
      path.join(directory, "ijma-sonkolon.md"),
      "# ইবাদত\n[পৃষ্ঠা 10]\nপাঁচ ওয়াক্ত নামাজ ফরজ হওয়ার ব্যাপারে উম্মাহর ইজমা রয়েছে।",
    );
    await writeFile(
      path.join(directory, "ijma-sonkolon.json"),
      JSON.stringify({ title: "মারাতিবুল ইজমা", author: "ইবনু হাযম", edition: "২য়" }),
    );
    await writeFile(
      path.join(directory, "sample.pdf"),
      minimalPdf(["Consensus on the five daily prayers", "", "Consensus on fasting Ramadan"]),
    );
    await writeFile(
      path.join(directory, "sample.pdf.json"),
      JSON.stringify({
        title: "Kitab al-Ijma",
        chapters: [
          { title: "Salah", page: 1 },
          { title: "Sawm", page: 3 },
        ],
      }),
    );
    await writeFile(path.join(directory, "scanned.pdf"), minimalPdf(["", ""]));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("builds chapter and page citations from real files and their metadata", async () => {
    const documents = await loadFileDocuments({
      sourceType: "ijma",
      directory,
      archiveRawFile: false,
    });

    expect(documents.map((document) => document.citation.reference).sort()).toEqual([
      "Kitab al-Ijma, Salah, পৃষ্ঠা 1",
      "Kitab al-Ijma, Sawm, পৃষ্ঠা 3",
      "মারাতিবুল ইজমা, ইবাদত, পৃষ্ঠা 10",
    ]);

    const markdown = documents.find((document) =>
      document.citation.reference.startsWith("মারাতিবুল"),
    );
    expect(markdown?.citation.page).toBe(10);
    expect(markdown?.provenance).toBe("মারাতিবুল ইজমা | ইবনু হাযম | ২য়");
    expect(documents.some((document) => document.metadata?.fileName === "scanned.pdf")).toBe(false);
  });
});

describe("multi-volume books and attribution front matter", () => {
  it("skips the front matter and reads volume and page together", () => {
    const sections = sectionsFromPlainText(
      '---\ntitle: "আল-ইকনা"\nlicense: "CC BY-NC-SA 4.0"\n---\n## كتاب الطهارة\n[খণ্ড 2, পৃষ্ঠা 10]\nوأجمعوا على أن الماء طهور',
    );

    expect(sections).toEqual([
      { text: "وأجمعوا على أن الماء طهور", chapter: "كتاب الطهارة", page: 10, volume: 2 },
    ]);
  });

  it("cites the volume before the page", () => {
    expect(
      formatBookReference({
        title: "আল-ইকনা",
        chapter: "كتاب الطهارة",
        volume: 2,
        page: 10,
        part: 1,
        partCount: 1,
      }),
    ).toBe("আল-ইকনা, كتاب الطهارة, খণ্ড 2, পৃষ্ঠা 10");
  });
});
