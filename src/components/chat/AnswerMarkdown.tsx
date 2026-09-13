"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import { isValidElement, memo, useMemo } from "react";
import { clsx } from "clsx";
import { isArabicDominant, prepareAnswer, splitMarkdownBlocks } from "@/lib/ai/answerText";

function childrenToText(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (isValidElement<{ children?: unknown }>(children)) {
    return childrenToText(children.props.children);
  }
  return "";
}

function isArabicBlock(children: unknown): boolean {
  return isArabicDominant(childrenToText(children));
}

const COMPONENTS: Components = {
  p: ({ children }) => (
    <p className={clsx("my-3 first:mt-0 last:mb-0", isArabicBlock(children) && "arabic")}>
      {children}
    </p>
  ),
  h1: ({ children }) => <h3 className="mt-6 mb-3 text-xl font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-6 mb-3 text-lg font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-5 mb-2 text-base font-semibold">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-4 mb-2 text-base font-semibold">{children}</h5>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 ps-6">{children}</ul>,
  ol: ({ children, start }) => (
    <ol start={start} className="my-3 list-decimal space-y-1.5 ps-6">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="ps-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-s-[3px] border-(--border-strong) ps-4 text-(--text-2)">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-md bg-(--surface-2) px-1.5 py-0.5 font-mono text-[0.875em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="thin-scroll my-3 overflow-x-auto rounded-xl bg-(--surface-2) p-4 text-sm">
      {children}
    </pre>
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
  hr: () => <hr className="my-5 border-(--border)" />,
  table: ({ children }) => (
    <div className="thin-scroll my-3 overflow-x-auto rounded-xl border border-(--border)">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-(--border) bg-(--surface-2) px-3 py-2 text-start font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-(--border) px-3 py-2 align-top">{children}</td>
  ),
};

const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return (
    <div className="answer-block">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

export function AnswerMarkdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = useMemo(() => splitMarkdownBlocks(prepareAnswer(text)), [text]);

  return (
    <div
      className={clsx(
        "answer-markdown text-base leading-[1.8] text-(--text-1) [&_.answer-block+.answer-block]:mt-3",
        streaming && "answer-streaming",
      )}
    >
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} text={block} />
      ))}
    </div>
  );
}
