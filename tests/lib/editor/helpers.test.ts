import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { arabicBlocksKey, arabicBlocksPlugin, isArabicBlockActive } from "@/lib/editor/arabic";
import { buildEditorExtensions } from "@/lib/editor/extensions";
import { isSafeHref, normalizeLinkInput } from "@/lib/editor/links";
import { markdownToDoc } from "@/lib/editor/markdown";
import { cleanPastedHtml, countWords, hasSemanticHtml, looksLikeMarkdown } from "@/lib/editor/text";

const schema = getSchema(buildEditorExtensions());

function stateFor(markdown: string) {
  return EditorState.create({
    schema,
    doc: schema.nodeFromJSON(markdownToDoc(markdown)),
    plugins: [arabicBlocksPlugin()],
  });
}

function decoratedTexts(state: EditorState): string[] {
  const set = arabicBlocksKey.getState(state)?.decorations;
  return (set?.find() ?? []).map((decoration) =>
    state.doc.textBetween(decoration.from, decoration.to, " "),
  );
}

describe("normalizeLinkInput", () => {
  it("accepts http, https and mailto and completes bare domains and emails", () => {
    expect(normalizeLinkInput("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(normalizeLinkInput("http://example.com")).toBe("http://example.com");
    expect(normalizeLinkInput("example.com/path")).toBe("https://example.com/path");
    expect(normalizeLinkInput("name@example.com")).toBe("mailto:name@example.com");
    expect(normalizeLinkInput("mailto:name@example.com")).toBe("mailto:name@example.com");
  });

  it("rejects other protocols, spaces and junk", () => {
    expect(normalizeLinkInput("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkInput("data:text/html,x")).toBeNull();
    expect(normalizeLinkInput("ftp://example.com")).toBeNull();
    expect(normalizeLinkInput("https://exa mple.com")).toBeNull();
    expect(normalizeLinkInput("নামাজ")).toBeNull();
    expect(normalizeLinkInput("")).toBeNull();
  });

  it("treats relative links as safe when they come from stored markdown", () => {
    expect(isSafeHref("/masail/abc")).toBe(true);
    expect(isSafeHref("#section")).toBe(true);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("vbscript:x")).toBe(false);
  });
});

describe("paste helpers", () => {
  it("recognises markdown in plain text but not ordinary prose", () => {
    expect(looksLikeMarkdown("## শিরোনাম\n\nলেখা")).toBe(true);
    expect(looksLikeMarkdown("- এক\n- দুই")).toBe(true);
    expect(looksLikeMarkdown("নামাজ **ফরজ**")).toBe(true);
    expect(looksLikeMarkdown("| ক | খ |\n| --- | --- |")).toBe(true);
    expect(looksLikeMarkdown("নামাজ ফরজ। যাকাত ফরজ [1]।")).toBe(false);
    expect(looksLikeMarkdown("৫ - ৩ = ২")).toBe(false);
  });

  it("detects semantic html and strips images, styles and comments", () => {
    expect(hasSemanticHtml("<p>লেখা</p>")).toBe(true);
    expect(hasSemanticHtml('<div style="color:red"><span>লেখা</span></div>')).toBe(false);
    const cleaned = cleanPastedHtml(
      '<!--x--><style>p{}</style><p>এক<img src="https://x/a.png" onerror="alert(1)"><o:p></o:p></p>',
    );
    expect(cleaned).toBe("<p>এক</p>");
  });

  it("counts Bangla, Arabic and English words", () => {
    expect(countWords("নামাজ **ফরজ** [1]")).toBe(3);
    expect(countWords("قُلْ هُوَ اللَّهُ أَحَدٌ")).toBe(4);
    expect(countWords("")).toBe(0);
  });
});

describe("arabic blocks", () => {
  it("marks Arabic dominant paragraphs and list items right to left, never Bangla ones", () => {
    const state = stateFor(
      "قُلْ هُوَ اللَّهُ أَحَدٌ\n\nবাংলা: বলুন, তিনি আল্লাহ, এক।\n\n- بِسْمِ اللَّهِ",
    );
    expect(decoratedTexts(state)).toEqual([
      "قُلْ هُوَ اللَّهُ أَحَدٌ",
      "بِسْمِ اللَّهِ",
      "بِسْمِ اللَّهِ",
    ]);
  });

  it("keeps a pending empty paragraph right to left until text decides", () => {
    let state = stateFor("লেখা\n\nআরও");
    const empty = state.tr.insert(state.doc.content.size, schema.nodes.paragraph!.create());
    state = state.apply(empty);
    const start = state.doc.content.size - 2;
    state = state.apply(
      state.tr
        .setSelection(TextSelection.create(state.doc, start + 1))
        .setMeta(arabicBlocksKey, { pending: start }),
    );
    expect(isArabicBlockActive(state)).toBe(true);
    expect(arabicBlocksKey.getState(state)?.pending).toBe(start);

    state = state.apply(state.tr.insertText("বাংলা", start + 1));
    expect(arabicBlocksKey.getState(state)?.pending).toBeNull();
    expect(isArabicBlockActive(state)).toBe(false);
  });
});
