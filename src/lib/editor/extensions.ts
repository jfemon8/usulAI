import { Extension, Node, mergeAttributes, type AnyExtension } from "@tiptap/core";
import { Code } from "@tiptap/extension-code";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { arabicBlocksPlugin } from "@/lib/editor/arabic";
import { isSafeHref } from "@/lib/editor/links";
import { markdownToDoc } from "@/lib/editor/markdown";
import { cleanPastedHtml, hasSemanticHtml, looksLikeMarkdown } from "@/lib/editor/text";

function textAttribute(name: string) {
  return {
    default: "",
    parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? "",
    renderHTML: (attributes: Record<string, unknown>) => ({
      [`data-${name}`]: String(attributes[name] ?? ""),
    }),
  };
}

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ latex: textAttribute("latex") }),
  parseHTML: () => [{ tag: "span[data-math-inline]" }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "span",
    mergeAttributes(HTMLAttributes, {
      "data-math-inline": "",
      class: "rich-editor-math",
      dir: "ltr",
    }),
    `$${String(node.attrs.latex)}$`,
  ],
});

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes: () => ({ latex: textAttribute("latex") }),
  parseHTML: () => [{ tag: "div[data-math-block]" }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, {
      "data-math-block": "",
      class: "rich-editor-math rich-editor-math-block",
      dir: "ltr",
    }),
    `$$ ${String(node.attrs.latex)} $$`,
  ],
});

export const RawMarkdown = Node.create({
  name: "rawMarkdown",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes: () => ({ markdown: textAttribute("markdown") }),
  parseHTML: () => [{ tag: "div[data-raw-markdown]" }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, {
      "data-raw-markdown": "",
      class: "rich-editor-raw",
      dir: "ltr",
      title: "মার্কডাউন মোডে সম্পাদনা করুন",
    }),
    String(node.attrs.markdown),
  ],
});

export const RawMarkdownInline = Node.create({
  name: "rawMarkdownInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ markdown: textAttribute("markdown") }),
  parseHTML: () => [{ tag: "span[data-raw-markdown-inline]" }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "span",
    mergeAttributes(HTMLAttributes, {
      "data-raw-markdown-inline": "",
      class: "rich-editor-raw rich-editor-raw-inline",
      dir: "ltr",
      title: "মার্কডাউন মোডে সম্পাদনা করুন",
    }),
    String(node.attrs.markdown),
  ],
});

const MarkdownAttributes = Extension.create({
  name: "markdownAttributes",
  addGlobalAttributes: () => [
    {
      types: ["bulletList", "orderedList"],
      attributes: {
        spread: { default: false, rendered: false, keepOnSplit: true },
      },
    },
    {
      types: ["codeBlock"],
      attributes: {
        meta: { default: null, rendered: false },
      },
    },
    {
      types: ["table"],
      attributes: {
        align: { default: null, rendered: false },
      },
    },
  ],
});

const markdownPasteKey = new PluginKey("markdownPaste");

const MarkdownPaste = Extension.create({
  name: "markdownPaste",
  addProseMirrorPlugins: () => [
    new Plugin({
      key: markdownPasteKey,
      props: {
        transformPastedHTML: cleanPastedHtml,
        handlePaste(view, event) {
          const data = event.clipboardData;
          if (!data) return false;
          const text = data.getData("text/plain");
          if (!text || view.state.selection.$from.parent.type.spec.code) return false;
          const html = data.getData("text/html");
          if (html && hasSemanticHtml(html)) return false;
          if (!looksLikeMarkdown(text)) return false;
          try {
            const doc = view.state.schema.nodeFromJSON(markdownToDoc(text));
            view.dispatch(
              view.state.tr.replaceSelection(Slice.maxOpen(doc.content)).scrollIntoView(),
            );
            return true;
          } catch {
            return false;
          }
        },
      },
    }),
  ],
});

const ArabicBlocks = Extension.create({
  name: "arabicBlocks",
  addProseMirrorPlugins: () => [arabicBlocksPlugin()],
});

export function buildEditorExtensions({
  placeholder,
}: { placeholder?: string } = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      code: false,
      underline: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        protocols: ["mailto"],
        isAllowedUri: (url) => isSafeHref(url),
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      },
    }),
    Code.extend({ excludes: "" }),
    Table.configure({ resizable: false, renderWrapper: true, allowTableNodeSelection: false }),
    TableRow,
    TableHeader.extend({ content: "paragraph" }),
    TableCell.extend({ content: "paragraph" }),
    MathInline,
    MathBlock,
    RawMarkdown,
    RawMarkdownInline,
    MarkdownAttributes,
    MarkdownPaste,
    ArabicBlocks,
    Placeholder.configure({ placeholder: placeholder ?? "" }),
  ];
}
