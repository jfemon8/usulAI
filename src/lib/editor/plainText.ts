import type { Nodes, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "list",
  "listItem",
  "table",
  "tableRow",
  "tableCell",
  "code",
  "thematicBreak",
]);

const parser = unified().use(remarkParse).use(remarkGfm);

function collect(node: Nodes, parts: string[]): void {
  if (node.type === "text" || node.type === "inlineCode") {
    parts.push(node.value);
    return;
  }
  if (node.type === "code" || node.type === "html" || node.type === "thematicBreak") {
    parts.push(" ");
    return;
  }
  if (node.type === "break") {
    parts.push(" ");
    return;
  }
  if ("children" in node) {
    for (const child of node.children) collect(child as Nodes, parts);
  }
  if (BLOCK_TYPES.has(node.type)) parts.push(" ");
}

export function markdownToPlainText(markdown: string): string {
  const tree = parser.parse(markdown) as Root;
  const parts: string[] = [];
  collect(tree, parts);
  return parts.join("").replace(/\s+/g, " ").trim();
}

export function markdownExcerpt(markdown: string, maxChars: number): string {
  const plain = markdownToPlainText(markdown);
  return plain.length > maxChars ? `${plain.slice(0, maxChars).trimEnd()}…` : plain;
}
