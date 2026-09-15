import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import type { Root } from "mdast";
import {
  docToMarkdown,
  markdownToDoc,
  normalizeMarkdown,
  parseMarkdownTree,
  unescapeCitations,
} from "@/lib/editor/markdown";
import { buildEditorExtensions } from "@/lib/editor/extensions";

const schema = getSchema(buildEditorExtensions());

function roundTrip(markdown: string): string {
  const doc = markdownToDoc(markdown);
  schema.nodeFromJSON(doc).check();
  return docToMarkdown(schema.nodeFromJSON(doc).toJSON());
}

function stripPositions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPositions);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "position")
        .map(([key, item]) => [key, stripPositions(item)]),
    );
  }
  return value;
}

function sameTree(left: string, right: string) {
  expect(stripPositions(parseMarkdownTree(right) as Root)).toEqual(
    stripPositions(parseMarkdownTree(left) as Root),
  );
}

const CANONICAL = [
  "## শিরোনাম\n\n### উপশিরোনাম\n\n#### ছোট শিরোনাম",
  "নামাজ **ফরজ** এবং *গুরুত্বপূর্ণ*, ~~ভুল~~ আর `কোড`।",
  "যাকাত ফরজ [1], হজও ফরজ [2] [3]।",
  "[1] দিয়ে শুরু হওয়া অনুচ্ছেদ।",
  "দেখুন [মাসআলা পাতা](https://example.com/masail?id=1) এবং [ইমেইল](mailto:info@example.com)।",
  '[শিরোনামসহ লিংক](https://example.com "শিরোনাম")',
  "- এক\n- দুই\n  - নেস্টেড এক\n  - নেস্টেড দুই\n- তিন",
  "1. প্রথম\n2. দ্বিতীয়\n   1. ভেতরের\n3. তৃতীয়",
  "5. পাঁচ থেকে শুরু\n6. ছয়",
  "- ঢিলা তালিকা\n\n- দ্বিতীয় আইটেম",
  "> উদ্ধৃতি [1]\n>\n> দ্বিতীয় অনুচ্ছেদ",
  "```\nconst a = 1;\n\nconst b = [1];\n```",
  "```ts\nlet x = 2;\n```",
  "---",
  "| প্রশ্ন | উত্তর |\n| --- | --- |\n| নামাজ | ফরজ [1] |\n| রোজা | ফরজ |",
  "| বাম | মাঝ | ডান |\n| :-- | :-: | --: |\n| ক | খ | গ |",
  "قُلْ هُوَ اللَّهُ أَحَدٌ\n\nবাংলা: বলুন, তিনি আল্লাহ, এক।",
  "লাইন এক\\\nলাইন দুই",
  "গণিত $a^2 + b^2$ এখানে।",
  "$$\n\\sum_{i=1}^{n} i\n$$",
  "***গুরুত্বপূর্ণ*** কথা",
  "**মোটা *বাঁকা* মোটা**",
  "[**মোটা লিংক**](https://example.com)",
  "প্রশ্ন: কী? উত্তর! ১০০% ঠিক। (বুখারী ১/২)",
  "![ছবি](https://example.com/a.png)",
  "- [ ] কাজ\n- [x] শেষ",
  "<div>কাঁচা HTML</div>",
  "টীকা[^1]\n\n[^1]: টীকার লেখা",
];

describe("markdown round trip", () => {
  it.each(CANONICAL)("keeps %j byte for byte", (markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("is idempotent for non canonical input and renders the same", () => {
    const inputs = [
      "* এক\n* দুই",
      "__মোটা__ আর _বাঁকা_",
      "লাইন এক  \nলাইন দুই",
      "Heading\n=======",
      "  শুরুর ফাঁকা",
      "5 * 3 = 15, a_b_c, #hash, <tag> & \\[1\\]",
      "https://example.com/path লিংক",
      "[রেফারেন্স][r]\n\n[r]: https://example.com",
      "| ক | খ |\n|---|---|\n| ১ |",
      "নরম\nলাইন ব্রেক",
      "~~~\nটিল্ড কোড\n~~~",
      "+ প্লাস",
    ];
    for (const input of inputs) {
      const once = roundTrip(input);
      expect(roundTrip(once)).toBe(once);
      sameTree(normalizeMarkdown(input), once);
    }
  });

  it("renders the same tree as the source for canonical and normalised input", () => {
    for (const markdown of CANONICAL) sameTree(markdown, roundTrip(markdown));
    sameTree("* এক\n* দুই", roundTrip("* এক\n* দুই"));
    sameTree("লাইন এক  \nলাইন দুই", roundTrip("লাইন এক  \nলাইন দুই"));
  });

  it("never escapes citations or Bangla punctuation", () => {
    const output = roundTrip("উত্তর [12]। দলিল [1], [2]; প্রশ্ন? হ্যাঁ! ইত্যাদি।");
    expect(output).toBe("উত্তর [12]। দলিল [1], [2]; প্রশ্ন? হ্যাঁ! ইত্যাদি।");
    expect(output).not.toContain("\\");
  });

  it("does not turn citations into links", () => {
    const doc = markdownToDoc("ফরজ [1]");
    expect(JSON.stringify(doc)).not.toContain('"link"');
    expect(doc.content?.[0]?.content).toEqual([{ type: "text", text: "ফরজ [1]" }]);
  });

  it("keeps a citation escaped where it would become a link or definition", () => {
    expect(unescapeCitations("\\[1](x)")).toBe("\\[1](x)");
    expect(unescapeCitations("\\[1]: লেখা")).toBe("\\[1]: লেখা");
    expect(unescapeCitations("\\[1]", "(")).toBe("\\[1]");
    expect(unescapeCitations("\\[1] লেখা")).toBe("[1] লেখা");
    const typed = docToMarkdown({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "[1]: সংজ্ঞা নয়" }] }],
    });
    expect(parseMarkdownTree(typed).children[0]?.type).toBe("paragraph");
  });

  it("converts the editor document back without stray whitespace inside marks", () => {
    const markdown = docToMarkdown({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "নামাজ" },
            { type: "text", text: " ফরজ ", marks: [{ type: "bold" }] },
            { type: "text", text: "ইবাদত" },
          ],
        },
      ],
    });
    expect(markdown).toBe("নামাজ **ফরজ** ইবাদত");
  });

  it("drops empty paragraphs and represents an empty document as an empty string", () => {
    expect(docToMarkdown(markdownToDoc(""))).toBe("");
    expect(
      docToMarkdown({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "এক" }] },
          { type: "paragraph" },
          { type: "paragraph" },
          { type: "paragraph", content: [{ type: "text", text: "দুই" }] },
        ],
      }),
    ).toBe("এক\n\nদুই");
  });

  it("parses Arabic and Bangla text unchanged", () => {
    const arabic = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
    const doc = markdownToDoc(`${arabic}\n\nবিসমিল্লাহ`);
    expect(doc.content?.[0]?.content?.[0]?.text).toBe(arabic);
    expect(roundTrip(`${arabic}\n\nবিসমিল্লাহ`)).toBe(`${arabic}\n\nবিসমিল্লাহ`);
  });

  it("keeps unsupported constructs as raw markdown", () => {
    const doc = markdownToDoc("- [ ] কাজ\n\n![ছবি](https://example.com/a.png)");
    expect(doc.content?.[0]?.type).toBe("rawMarkdown");
    expect(doc.content?.[1]?.content?.[0]?.type).toBe("rawMarkdownInline");
  });

  it("keeps unsafe links as raw markdown instead of links", () => {
    const doc = markdownToDoc("[ক্লিক](javascript:alert(1))");
    expect(JSON.stringify(doc)).not.toContain('"link"');
    expect(roundTrip("[ক্লিক](javascript:alert\\(1\\))")).toBe("[ক্লিক](javascript:alert\\(1\\))");
  });

  it("flattens hard breaks inside table cells into spaces", () => {
    const markdown = docToMarkdown({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "ক" }] }],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "এক" },
                        { type: "hardBreak" },
                        { type: "text", text: "দুই" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(markdown).toBe("| ক |\n| --- |\n| এক দুই |");
  });
});
