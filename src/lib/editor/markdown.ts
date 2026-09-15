import type { JSONContent } from "@tiptap/core";
import type {
  AlignType,
  BlockContent,
  Code,
  DefinitionContent,
  Heading,
  List,
  ListItem,
  Parents,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
  Text,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify, { type Options as StringifyOptions } from "remark-stringify";
import { unified } from "unified";
import { isSafeHref } from "@/lib/editor/links";

type Mark = NonNullable<JSONContent["marks"]>[number];
type FlowContent = BlockContent | DefinitionContent;

interface TextHandlerInfo {
  before: string;
  after: string;
}

interface SafeState {
  safe: (value: string, config: TextHandlerInfo) => string;
}

const STRINGIFY_OPTIONS: StringifyOptions = {
  bullet: "-",
  bulletOther: "*",
  emphasis: "*",
  strong: "*",
  fence: "`",
  fences: true,
  rule: "-",
  ruleRepetition: 3,
  ruleSpaces: false,
  listItemIndent: "one",
  incrementListMarker: true,
  setext: false,
  closeAtx: false,
  handlers: {
    text: (node: Text, _parent: Parents | undefined, state: SafeState, info: TextHandlerInfo) =>
      unescapeCitations(state.safe(node.value, info), info.after),
  } as StringifyOptions["handlers"],
};

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).freeze();

const stringifier = unified()
  .use(remarkStringify, STRINGIFY_OPTIONS)
  .use(remarkGfm, { tablePipeAlign: true, tableCellPadding: true, stringLength: () => 3 })
  .use(remarkMath)
  .freeze();

const ESCAPED_CITATION = /\\\[(\d{1,4})\]/g;
const MARK_SYNTAX: Record<string, "strong" | "emphasis" | "delete" | "link"> = {
  bold: "strong",
  italic: "emphasis",
  strike: "delete",
  link: "link",
};
const WHITESPACE_START = /^\s+/u;
const WHITESPACE_END = /\s+$/u;

export function unescapeCitations(value: string, after = ""): string {
  return value.replace(ESCAPED_CITATION, (match, digits: string, offset: number) => {
    const next = value[offset + match.length] ?? after.charAt(0);
    if (next === "(" || next === "[" || next === ":") return match;
    return `[${digits}]`;
  });
}

export function parseMarkdownTree(markdown: string): Root {
  return parser.parse(markdown);
}

export function stringifyMarkdownTree(tree: Root): string {
  return stringifier.stringify(tree).replace(/\n+$/, "");
}

function rawBlock(node: RootContent): JSONContent {
  const markdown =
    node.type === "html" ? node.value : stringifyMarkdownTree({ type: "root", children: [node] });
  return { type: "rawMarkdown", attrs: { markdown } };
}

function rawInline(node: PhrasingContent): JSONContent {
  const markdown =
    node.type === "html"
      ? node.value
      : stringifyMarkdownTree({
          type: "root",
          children: [{ type: "paragraph", children: [node] }],
        });
  return { type: "rawMarkdownInline", attrs: { markdown } };
}

function withMarks(node: JSONContent, marks: readonly Mark[]): JSONContent {
  return marks.length > 0 ? { ...node, marks: [...marks] } : node;
}

function inlineFromTree(nodes: readonly PhrasingContent[], marks: readonly Mark[]): JSONContent[] {
  const output: JSONContent[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        if (node.value) output.push(withMarks({ type: "text", text: node.value }, marks));
        break;
      case "inlineCode":
        if (node.value) {
          output.push(withMarks({ type: "text", text: node.value }, [...marks, { type: "code" }]));
        }
        break;
      case "strong":
        output.push(...inlineFromTree(node.children, [...marks, { type: "bold" }]));
        break;
      case "emphasis":
        output.push(...inlineFromTree(node.children, [...marks, { type: "italic" }]));
        break;
      case "delete":
        output.push(...inlineFromTree(node.children, [...marks, { type: "strike" }]));
        break;
      case "link":
        if (isSafeHref(node.url) && node.children.length > 0) {
          const attrs = { href: node.url, title: node.title ?? null };
          output.push(...inlineFromTree(node.children, [...marks, { type: "link", attrs }]));
        } else {
          output.push(withMarks(rawInline(node), marks));
        }
        break;
      case "break":
        output.push({ type: "hardBreak" });
        break;
      case "inlineMath":
        output.push({ type: "mathInline", attrs: { latex: node.value } });
        break;
      default:
        output.push(withMarks(rawInline(node), marks));
    }
  }
  return output;
}

function paragraph(children: readonly PhrasingContent[]): JSONContent {
  const content = inlineFromTree(children, []);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

function blocksOrEmpty(nodes: readonly RootContent[]): JSONContent[] {
  const content = blocksFromTree(nodes);
  return content.length > 0 ? content : [{ type: "paragraph" }];
}

function listFromTree(list: List): JSONContent {
  const convertible = list.children.every(
    (item) =>
      (item.checked === null || item.checked === undefined) &&
      (item.children.length === 0 || item.children[0]?.type === "paragraph"),
  );
  if (!convertible) return rawBlock(list);

  const spread = Boolean(list.spread) || list.children.some((item) => Boolean(item.spread));
  const content = list.children.map((item) => ({
    type: "listItem",
    content: blocksOrEmpty(item.children),
  }));

  if (list.ordered) {
    return { type: "orderedList", attrs: { start: list.start ?? 1, spread }, content };
  }
  return { type: "bulletList", attrs: { spread }, content };
}

function tableFromTree(table: Table): JSONContent {
  const width = Math.max(1, ...table.children.map((row) => row.children.length));
  const content = table.children.map((row, rowIndex) => {
    const cells = Array.from({ length: width }, (_, cellIndex) => {
      const cell = row.children[cellIndex];
      return {
        type: rowIndex === 0 ? "tableHeader" : "tableCell",
        content: [paragraph(cell ? cell.children : [])],
      };
    });
    return { type: "tableRow", content: cells };
  });
  const align = table.align && table.align.some((value) => value) ? [...table.align] : null;
  return { type: "table", attrs: { align }, content };
}

function blocksFromTree(nodes: readonly RootContent[]): JSONContent[] {
  const output: JSONContent[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        output.push(paragraph(node.children));
        break;
      case "heading":
        output.push({
          type: "heading",
          attrs: { level: node.depth },
          ...(node.children.length > 0 ? { content: inlineFromTree(node.children, []) } : {}),
        });
        break;
      case "blockquote":
        output.push({ type: "blockquote", content: blocksOrEmpty(node.children) });
        break;
      case "list":
        output.push(listFromTree(node));
        break;
      case "code":
        output.push({
          type: "codeBlock",
          attrs: { language: node.lang ?? null, meta: node.meta ?? null },
          ...(node.value ? { content: [{ type: "text", text: node.value }] } : {}),
        });
        break;
      case "thematicBreak":
        output.push({ type: "horizontalRule" });
        break;
      case "table":
        output.push(tableFromTree(node));
        break;
      case "math":
        output.push({ type: "mathBlock", attrs: { latex: node.value } });
        break;
      default:
        output.push(rawBlock(node));
    }
  }
  return output;
}

export function markdownToDoc(markdown: string): JSONContent {
  const content = blocksFromTree(parseMarkdownTree(markdown).children);
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

function sameMark(left: Mark, right: Mark): boolean {
  if (left.type !== right.type) return false;
  if (left.type !== "link") return true;
  return (
    left.attrs?.href === right.attrs?.href &&
    (left.attrs?.title ?? null) === (right.attrs?.title ?? null)
  );
}

interface InlineItem {
  node: JSONContent;
  marks: Mark[];
  code: boolean;
}

function syntaxMarks(node: JSONContent): Mark[] {
  return (node.marks ?? []).filter((mark) => mark.type in MARK_SYNTAX);
}

function isCode(node: JSONContent): boolean {
  return (node.marks ?? []).some((mark) => mark.type === "code");
}

function shared(marks: readonly Mark[], neighbour: InlineItem | undefined): Mark[] {
  return marks.filter(
    (mark) =>
      mark.type === "link" ||
      (neighbour !== undefined && neighbour.marks.some((other) => sameMark(other, mark))),
  );
}

function sharedBoth(
  marks: readonly Mark[],
  previous: InlineItem | undefined,
  next: InlineItem | undefined,
): Mark[] {
  return shared(shared(marks, previous), next);
}

function inlineItems(nodes: readonly JSONContent[]): InlineItem[] {
  const base = nodes.map((node) => ({ node, marks: syntaxMarks(node), code: isCode(node) }));
  const items: InlineItem[] = [];

  base.forEach((item, index) => {
    const text = item.node.type === "text" ? (item.node.text ?? "") : null;
    const flanked = item.marks.some((mark) => mark.type !== "link");
    if (text === null || item.code || !flanked) {
      items.push(item);
      return;
    }

    const previous = base[index - 1];
    const next = base[index + 1];
    const leading = text.match(WHITESPACE_START)?.[0] ?? "";
    if (leading.length === text.length) {
      items.push({ ...item, marks: sharedBoth(item.marks, previous, next) });
      return;
    }
    const trailing = text.match(WHITESPACE_END)?.[0] ?? "";
    const core = text.slice(leading.length, text.length - trailing.length);

    if (leading) {
      items.push({
        node: { type: "text", text: leading },
        marks: shared(item.marks, previous),
        code: false,
      });
    }
    items.push({ ...item, node: { ...item.node, text: core } });
    if (trailing) {
      items.push({
        node: { type: "text", text: trailing },
        marks: shared(item.marks, next),
        code: false,
      });
    }
  });

  return items;
}

function runLength(items: readonly InlineItem[], start: number, mark: Mark): number {
  let end = start;
  while (end < items.length && items[end]?.marks.some((other) => sameMark(other, mark))) end += 1;
  return end - start;
}

function leaf(item: InlineItem, inTable: boolean): PhrasingContent | null {
  const { node } = item;
  switch (node.type) {
    case "text":
      if (!node.text) return null;
      return item.code
        ? { type: "inlineCode", value: node.text }
        : { type: "text", value: inTable ? node.text.replace(/\n/g, " ") : node.text };
    case "hardBreak":
      return inTable ? { type: "text", value: " " } : { type: "break" };
    case "mathInline":
      return { type: "inlineMath", value: String(node.attrs?.latex ?? "") };
    case "rawMarkdownInline":
      return { type: "html", value: String(node.attrs?.markdown ?? "") };
    default:
      return null;
  }
}

interface Frame {
  mark: Mark;
  children: PhrasingContent[];
}

function markNode(mark: Mark, children: PhrasingContent[]): PhrasingContent {
  const kind = MARK_SYNTAX[mark.type];
  if (kind === "link") {
    const title = mark.attrs?.title;
    return {
      type: "link",
      url: String(mark.attrs?.href ?? ""),
      title: typeof title === "string" && title ? title : null,
      children: children as Extract<PhrasingContent, { type: "text" }>[],
    };
  }
  if (kind === "strong") return { type: "strong", children };
  if (kind === "delete") return { type: "delete", children };
  return { type: "emphasis", children };
}

function phrasingFromDoc(
  nodes: readonly JSONContent[] | undefined,
  inTable = false,
): PhrasingContent[] {
  const items = inlineItems(nodes ?? []);
  const root: PhrasingContent[] = [];
  const stack: Frame[] = [];
  const target = () => stack[stack.length - 1]?.children ?? root;

  const close = () => {
    const frame = stack.pop();
    if (!frame) return;
    if (frame.children.length > 0) target().push(markNode(frame.mark, frame.children));
  };

  items.forEach((item, index) => {
    let keep = 0;
    while (
      keep < stack.length &&
      item.marks.some((mark) => {
        const frame = stack[keep];
        return frame !== undefined && sameMark(mark, frame.mark);
      })
    ) {
      keep += 1;
    }
    while (stack.length > keep) close();

    const opening = item.marks
      .filter((mark) => !stack.some((frame) => sameMark(frame.mark, mark)))
      .sort((left, right) => {
        if (left.type === "link" && right.type !== "link") return -1;
        if (right.type === "link" && left.type !== "link") return 1;
        return runLength(items, index, right) - runLength(items, index, left);
      });
    for (const mark of opening) stack.push({ mark, children: [] });

    const node = leaf(item, inTable);
    if (node) target().push(node);
  });

  while (stack.length > 0) close();
  return root;
}

function textOf(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textOf).join("");
}

function isEmptyParagraph(node: JSONContent): boolean {
  return node.type === "paragraph" && (node.content ?? []).length === 0;
}

function listItemFromDoc(node: JSONContent, spread: boolean): ListItem {
  const children = (node.content ?? []).filter((child) => !isEmptyParagraph(child));
  return { type: "listItem", spread, children: flowFromDoc(children) };
}

function tableFromDoc(node: JSONContent): Table {
  const rows = node.content ?? [];
  const width = Math.max(1, ...rows.map((row) => (row.content ?? []).length));
  const stored = node.attrs?.align;
  const align: AlignType[] = Array.from({ length: width }, (_, index) => {
    const value = Array.isArray(stored) ? stored[index] : null;
    return value === "left" || value === "right" || value === "center" ? value : null;
  });

  const children: TableRow[] = rows.map((row) => ({
    type: "tableRow",
    children: Array.from({ length: width }, (_, index): TableCell => {
      const cell = row.content?.[index];
      const inline = (cell?.content ?? []).flatMap((block, blockIndex) => {
        const parts = block.type === "paragraph" ? (block.content ?? []) : [];
        return blockIndex > 0 && parts.length > 0 ? [{ type: "text", text: " " }, ...parts] : parts;
      });
      return { type: "tableCell", children: phrasingFromDoc(inline, true) };
    }),
  }));

  return { type: "table", align, children };
}

function flowFromDoc(nodes: readonly JSONContent[]): FlowContent[] {
  const output: FlowContent[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const children = phrasingFromDoc(node.content);
        if (children.length > 0) output.push({ type: "paragraph", children });
        break;
      }
      case "heading": {
        const level = Number(node.attrs?.level ?? 2);
        const depth = (level >= 1 && level <= 6 ? level : 2) as Heading["depth"];
        output.push({ type: "heading", depth, children: phrasingFromDoc(node.content) });
        break;
      }
      case "blockquote":
        output.push({ type: "blockquote", children: flowFromDoc(node.content ?? []) });
        break;
      case "bulletList":
      case "orderedList": {
        const spread = Boolean(node.attrs?.spread);
        const list: List = {
          type: "list",
          ordered: node.type === "orderedList",
          spread,
          children: (node.content ?? []).map((item) => listItemFromDoc(item, spread)),
        };
        if (node.type === "orderedList") list.start = Number(node.attrs?.start ?? 1);
        output.push(list);
        break;
      }
      case "codeBlock": {
        const language = node.attrs?.language;
        const meta = node.attrs?.meta;
        const code: Code = {
          type: "code",
          lang: typeof language === "string" && language ? language : null,
          meta: typeof meta === "string" && meta ? meta : null,
          value: textOf(node),
        };
        output.push(code);
        break;
      }
      case "horizontalRule":
        output.push({ type: "thematicBreak" });
        break;
      case "table":
        output.push(tableFromDoc(node));
        break;
      case "mathBlock":
        output.push({ type: "math", value: String(node.attrs?.latex ?? "") } as FlowContent);
        break;
      case "rawMarkdown":
        output.push({ type: "html", value: String(node.attrs?.markdown ?? "") });
        break;
      default:
        break;
    }
  }
  return output;
}

export function docToTree(doc: JSONContent): Root {
  return { type: "root", children: flowFromDoc(doc.content ?? []) as RootContent[] };
}

export function docToMarkdown(doc: JSONContent): string {
  return stringifyMarkdownTree(docToTree(doc));
}

export function normalizeMarkdown(markdown: string): string {
  return docToMarkdown(markdownToDoc(markdown));
}
