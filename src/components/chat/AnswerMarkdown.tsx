"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import { clsx } from "clsx";
import { stripTrailingSources } from "@/lib/ai/answerText";

const ARABIC_RANGE = /[؀-ۿ]/;
const TRANSLATION_LABEL = /^(বাংলা|English)\s*:/;

function childrenToText(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  return "";
}

function isArabicBlock(children: unknown): boolean {
  const text = childrenToText(children).trim();
  return ARABIC_RANGE.test(text) && !TRANSLATION_LABEL.test(text);
}

const COMPONENTS: Components = {
  p: ({ children }) => (
    <p className={clsx("my-2 first:mt-0 last:mb-0", isArabicBlock(children) && "arabic")}>
      {children}
    </p>
  ),
  h1: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1.5 text-sm font-semibold">{children}</h4>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 ps-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 ps-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-s-2 border-(--accent) ps-3 text-(--text-2) italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="glass rounded px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="glass my-2 overflow-x-auto rounded-lg p-3 text-xs">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-(--accent) underline underline-offset-2"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-(--glass-border)" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-(--glass-border) px-2 py-1 text-start font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-(--glass-border) px-2 py-1 align-top">{children}</td>
  ),
};

export function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="answer-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        components={COMPONENTS}
      >
        {stripTrailingSources(text)}
      </ReactMarkdown>
    </div>
  );
}
