"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { clsx } from "clsx";
import {
  BoldIcon,
  BulletListIcon,
  CitationIcon,
  ClearFormatIcon,
  CodeBlockIcon,
  CodeIcon,
  CollapseIcon,
  ColumnAddIcon,
  ColumnDeleteIcon,
  ExpandIcon,
  ItalicIcon,
  LinkIcon,
  MarkdownIcon,
  MathIcon,
  OrderedListIcon,
  PreviewIcon,
  QuoteIcon,
  RedoIcon,
  RowAddIcon,
  RowDeleteIcon,
  RtlIcon,
  RuleIcon,
  StrikeIcon,
  TableDeleteIcon,
  TableIcon,
  UndoIcon,
  WriteIcon,
} from "@/components/editor/EditorIcons";
import { RichContent } from "@/components/editor/RichContent";
import type { RichTextEditorProps } from "@/components/editor/types";
import { isArabicBlockActive, toggleArabicBlock } from "@/lib/editor/arabic";
import { buildEditorExtensions } from "@/lib/editor/extensions";
import { normalizeLinkInput } from "@/lib/editor/links";
import { docToMarkdown, markdownToDoc, normalizeMarkdown } from "@/lib/editor/markdown";
import { countWords } from "@/lib/editor/text";

type Mode = "visual" | "markdown" | "preview";
type Panel = "link" | "citation" | "math" | null;

const MODES: { value: Mode; label: string; icon: ReactNode }[] = [
  { value: "visual", label: "লিখুন", icon: <WriteIcon className="h-4 w-4" /> },
  { value: "markdown", label: "মার্কডাউন", icon: <MarkdownIcon className="h-4 w-4" /> },
  { value: "preview", label: "প্রিভিউ", icon: <PreviewIcon className="h-4 w-4" /> },
];

const HEADING_NAMES: Record<number, string> = {
  1: "শিরোনাম ১",
  2: "শিরোনাম ২",
  3: "শিরোনাম ৩",
  4: "শিরোনাম ৪",
  5: "শিরোনাম ৫",
  6: "শিরোনাম ৬",
};

const EMPTY_SOURCES: NonNullable<RichTextEditorProps["sources"]> = [];

function bn(value: number): string {
  return value.toLocaleString("bn-BD");
}

function selectedMath(editor: Editor): { pos: number; latex: string } | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return null;
  const name = selection.node.type.name;
  if (name !== "mathInline" && name !== "mathBlock") return null;
  return { pos: selection.from, latex: String(selection.node.attrs.latex ?? "") };
}

function headingLevel(editor: Editor): number {
  for (const level of [1, 2, 3, 4, 5, 6]) {
    if (editor.isActive("heading", { level })) return level;
  }
  return 0;
}

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-40",
        active
          ? "bg-(--accent-soft) text-(--accent)"
          : "text-(--text-2) hover:bg-(--surface-2) hover:text-(--text-1)",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 bg-(--border)" />;
}

function PanelShell({
  label,
  children,
  onClose,
}: {
  label: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          onClose();
        }
      }}
      className="border-t border-(--border) bg-(--sidebar-bg) px-2 py-2 sm:px-3"
    >
      {children}
    </div>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "এখানে লিখুন…",
  minHeight = 288,
  maxLength,
  label,
  ariaLabel,
  disabled = false,
  invalid = false,
  sources = EMPTY_SOURCES,
  id,
  toolbarOffset = "header",
}: RichTextEditorProps) {
  const generatedId = useId();
  const editorId = id ?? `${generatedId}-editor`;
  const footerId = `${generatedId}-footer`;
  const panelInputId = `${generatedId}-panel`;
  const [mode, setMode] = useState<Mode>("visual");
  const [fullscreen, setFullscreen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [panelValue, setPanelValue] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  const received = useRef({ raw: value, normalized: "" });
  const normalizedReady = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [options] = useState(() => ({
    extensions: buildEditorExtensions({ placeholder }),
    content: markdownToDoc(value),
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        id: editorId,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel ?? label ?? "লেখা",
        "aria-describedby": footerId,
        class:
          "rich-editor-content answer-markdown px-4 py-3 text-base leading-[1.8] text-(--text-1) outline-none sm:px-5",
      },
    },
  }));

  const editor = useEditor({
    ...options,
    onUpdate: ({ editor: current }) => {
      const markdown = docToMarkdown(current.getJSON());
      if (!normalizedReady.current) {
        received.current.normalized = normalizeMarkdown(received.current.raw);
        normalizedReady.current = true;
      }
      if (markdown === received.current.normalized) return;
      received.current = { raw: markdown, normalized: markdown };
      onChangeRef.current(markdown);
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      return {
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        strike: current.isActive("strike"),
        code: current.isActive("code"),
        link: current.isActive("link"),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
        blockquote: current.isActive("blockquote"),
        codeBlock: current.isActive("codeBlock"),
        table: current.isActive("table"),
        heading: headingLevel(current),
        math: selectedMath(current) !== null,
        arabic: isArabicBlockActive(current.state),
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      };
    },
  });

  useEffect(() => {
    if (!editor || mode !== "visual") return;
    if (value === received.current.raw) return;
    const normalized = normalizeMarkdown(value);
    received.current = { raw: value, normalized };
    normalizedReady.current = true;
    if (normalized === docToMarkdown(editor.getJSON())) return;
    editor.commands.setContent(markdownToDoc(value), { emitUpdate: false });
  }, [editor, value, mode]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  useEffect(() => {
    if (!fullscreen) return;
    const root = document.documentElement;
    const { body } = document;
    const previous = { root: root.style.overflow, body: body.style.overflow };
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (panel) {
        setPanel(null);
        setPanelError(null);
      } else {
        setFullscreen(false);
      }
      editor?.commands.focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      root.style.overflow = previous.root;
      body.style.overflow = previous.body;
      document.removeEventListener("keydown", onKey, true);
    };
  }, [fullscreen, panel, editor]);

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl";
  const ready = editor !== null && state !== null && !disabled;
  const characters = value.length;
  const words = countWords(value);
  const over = maxLength !== undefined && value.trim().length > maxLength;
  const near = maxLength !== undefined && !over && characters >= maxLength * 0.9;

  function closePanel() {
    setPanel(null);
    setPanelError(null);
    editor?.commands.focus();
  }

  function openLink() {
    if (!editor || disabled) return;
    const href = editor.getAttributes("link").href;
    setPanelValue(typeof href === "string" ? href : "");
    setPanelError(null);
    setPanel("link");
  }

  function openMath() {
    if (!editor || disabled) return;
    setPanelValue(selectedMath(editor)?.latex ?? "");
    setPanelError(null);
    setPanel("math");
  }

  function applyLink() {
    if (!editor) return;
    const href = normalizeLinkInput(panelValue);
    if (!href) {
      setPanelError("সঠিক লিংক দিন, যেমন https://example.com বা mailto:name@example.com");
      return;
    }
    const { selection } = editor.state;
    if (selection.empty && !editor.isActive("link")) {
      const text = href.replace(/^mailto:/, "");
      editor
        .chain()
        .focus()
        .command(({ tr, state: current }) => {
          const linkMark = current.schema.marks.link;
          if (!linkMark) return false;
          const from = tr.selection.from;
          tr.insertText(text, from, from);
          tr.addMark(from, from + text.length, linkMark.create({ href }));
          return true;
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setPanel(null);
    setPanelError(null);
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setPanel(null);
  }

  function applyMath() {
    if (!editor) return;
    const latex = panelValue.trim();
    const selected = selectedMath(editor);
    if (selected) {
      if (!latex) {
        editor.chain().focus().deleteSelection().run();
      } else {
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            const node = tr.doc.nodeAt(selected.pos);
            if (!node) return false;
            tr.setNodeMarkup(selected.pos, undefined, { ...node.attrs, latex });
            return true;
          })
          .run();
      }
    } else if (latex) {
      editor.chain().focus().insertContent({ type: "mathInline", attrs: { latex } }).run();
    }
    setPanel(null);
  }

  function insertCitation(index: number) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const { from, to } = tr.selection;
        const before = from > 0 ? tr.doc.textBetween(from - 1, from, "\n", "\n") : "";
        const text = `${before && !/[\s[(]/u.test(before) ? " " : ""}[${index}]`;
        tr.insertText(text, from, to);
        tr.removeMark(from, from + text.length);
        return true;
      })
      .run();
    setPanel(null);
  }

  function setBlockType(next: string) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (next === "paragraph") chain.setParagraph().run();
    else chain.setHeading({ level: Number(next) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const modifier = isMac ? event.metaKey : event.ctrlKey;
    if (mode !== "visual") return;
    if (modifier && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openLink();
    }
  }

  function toggleFullscreen() {
    setFullscreen((previous) => !previous);
    requestAnimationFrame(() => editor?.commands.focus());
  }

  function switchMode(next: Mode) {
    setPanel(null);
    setMode(next);
  }

  const frameStyle = { "--editor-min-height": `${minHeight}px` } as CSSProperties;
  const toolbarSticky = fullscreen
    ? ""
    : toolbarOffset === "header"
      ? "sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 lg:top-0"
      : "sticky top-0 z-20";
  const headingValue = state?.heading ? String(state.heading) : "paragraph";

  const frame = (
    <div
      className={clsx(
        "rich-editor",
        fullscreen &&
          "fixed inset-0 z-[65] flex flex-col bg-(--bg) px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4",
      )}
      style={frameStyle}
      onKeyDown={onKeyDown}
    >
      <div
        role={fullscreen ? "dialog" : undefined}
        aria-modal={fullscreen ? true : undefined}
        aria-label={fullscreen ? (label ?? "লেখা সম্পাদক") : undefined}
        className={clsx(
          "flex min-w-0 flex-col rounded-xl border bg-(--bg) transition",
          fullscreen && "mx-auto min-h-0 w-full max-w-4xl flex-1",
          invalid || over
            ? "border-(--danger)"
            : "border-(--border) focus-within:border-(--accent) focus-within:ring-2 focus-within:ring-(--accent-soft)",
          disabled && "opacity-70",
        )}
      >
        <div
          className={clsx(
            "rounded-t-xl border-b border-(--border) bg-(--bg)/95 backdrop-blur",
            toolbarSticky,
          )}
        >
          <div className="flex items-center justify-between gap-2 px-1.5 pt-1.5 pb-1 sm:px-2">
            <div
              role="tablist"
              aria-label="সম্পাদকের দৃশ্য"
              className="flex min-w-0 rounded-lg bg-(--surface-2) p-0.5"
            >
              {MODES.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  role="tab"
                  aria-selected={mode === entry.value}
                  onClick={() => switchMode(entry.value)}
                  className={clsx(
                    "flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm whitespace-nowrap transition sm:px-3",
                    mode === entry.value
                      ? "bg-(--bg) font-medium text-(--text-1) shadow-sm"
                      : "text-(--text-2) hover:text-(--text-1)",
                  )}
                >
                  {entry.icon}
                  <span className={clsx(entry.value === "markdown" && "hidden min-[400px]:inline")}>
                    {entry.label}
                  </span>
                </button>
              ))}
            </div>
            <ToolButton
              label={fullscreen ? "পূর্ণ পর্দা বন্ধ করুন" : "পূর্ণ পর্দায় লিখুন"}
              shortcut={fullscreen ? "Esc" : undefined}
              active={fullscreen}
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <CollapseIcon className="h-4 w-4" />
              ) : (
                <ExpandIcon className="h-4 w-4" />
              )}
            </ToolButton>
          </div>

          {mode === "visual" ? (
            <div
              role="toolbar"
              aria-label="লেখার বিন্যাস"
              aria-controls={editorId}
              className="thin-scroll flex items-center gap-0.5 overflow-x-auto px-1.5 pb-1.5 sm:px-2"
            >
              <ToolButton
                label="আগের অবস্থায় ফিরুন"
                shortcut={`${mod}+Z`}
                disabled={!ready || !state?.canUndo}
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <UndoIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="আবার করুন"
                shortcut={isMac ? "⌘+Shift+Z" : "Ctrl+Y"}
                disabled={!ready || !state?.canRedo}
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <RedoIcon className="h-4 w-4" />
              </ToolButton>
              <Divider />
              <select
                aria-label="লেখার ধরন"
                title="লেখার ধরন"
                value={headingValue}
                disabled={!ready}
                onChange={(event) => setBlockType(event.target.value)}
                className="h-10 shrink-0 rounded-lg border border-(--border) bg-(--bg) px-2 text-sm text-(--text-1) outline-none focus:border-(--accent) disabled:opacity-40"
              >
                <option value="paragraph">সাধারণ লেখা</option>
                {[1, 2, 3, 4, 5, 6]
                  .filter((level) => (level >= 2 && level <= 4) || state?.heading === level)
                  .map((level) => (
                    <option key={level} value={String(level)}>
                      {HEADING_NAMES[level]}
                    </option>
                  ))}
              </select>
              <Divider />
              <ToolButton
                label="মোটা"
                shortcut={`${mod}+B`}
                active={state?.bold}
                disabled={!ready}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <BoldIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="বাঁকা"
                shortcut={`${mod}+I`}
                active={state?.italic}
                disabled={!ready}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <ItalicIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="কাটা দাগ"
                shortcut={`${mod}+Shift+S`}
                active={state?.strike}
                disabled={!ready}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
              >
                <StrikeIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="ইনলাইন কোড"
                shortcut={`${mod}+E`}
                active={state?.code}
                disabled={!ready}
                onClick={() => editor?.chain().focus().toggleCode().run()}
              >
                <CodeIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="লিংক"
                shortcut={`${mod}+K`}
                active={state?.link || panel === "link"}
                disabled={!ready}
                onClick={() => (panel === "link" ? closePanel() : openLink())}
              >
                <LinkIcon className="h-4 w-4" />
              </ToolButton>
              <Divider />
              <ToolButton
                label="বুলেট তালিকা"
                shortcut={`${mod}+Shift+8`}
                active={state?.bulletList}
                disabled={!ready}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <BulletListIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="নম্বর তালিকা"
                shortcut={`${mod}+Shift+7`}
                active={state?.orderedList}
                disabled={!ready}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <OrderedListIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="উদ্ধৃতি"
                shortcut={`${mod}+Shift+B`}
                active={state?.blockquote}
                disabled={!ready}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                <QuoteIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="কোড ব্লক"
                shortcut={`${mod}+Alt+C`}
                active={state?.codeBlock}
                disabled={!ready}
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              >
                <CodeBlockIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="বিভাজক রেখা"
                disabled={!ready}
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              >
                <RuleIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="টেবিল যোগ করুন"
                active={state?.table}
                disabled={!ready || state?.table}
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                <TableIcon className="h-4 w-4" />
              </ToolButton>
              <Divider />
              <ToolButton
                label="আরবি অনুচ্ছেদ (ডান থেকে বাম)"
                active={state?.arabic}
                disabled={!ready || state?.codeBlock}
                onClick={() => editor && toggleArabicBlock(editor)}
              >
                <RtlIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label={
                  sources.length > 0 ? "সূত্রের নম্বর যোগ করুন" : "সূত্র যোগ করলে নম্বর দেওয়া যাবে"
                }
                active={panel === "citation"}
                disabled={!ready || sources.length === 0}
                onClick={() => (panel === "citation" ? closePanel() : setPanel("citation"))}
              >
                <CitationIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="গাণিতিক সূত্র"
                active={state?.math || panel === "math"}
                disabled={!ready}
                onClick={() => (panel === "math" ? closePanel() : openMath())}
              >
                <MathIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="বিন্যাস মুছুন"
                disabled={!ready}
                onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
              >
                <ClearFormatIcon className="h-4 w-4" />
              </ToolButton>
            </div>
          ) : null}

          {mode === "visual" && state?.table ? (
            <div
              role="toolbar"
              aria-label="টেবিল"
              className="thin-scroll flex items-center gap-0.5 overflow-x-auto border-t border-(--border) px-1.5 py-1 sm:px-2"
            >
              <span className="shrink-0 px-2 text-xs font-medium text-(--text-3)">টেবিল</span>
              <ToolButton
                label="নিচে সারি যোগ করুন"
                disabled={!ready}
                onClick={() => editor?.chain().focus().addRowAfter().run()}
              >
                <RowAddIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="সারি মুছুন"
                disabled={!ready}
                onClick={() => editor?.chain().focus().deleteRow().run()}
              >
                <RowDeleteIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="ডানে কলাম যোগ করুন"
                disabled={!ready}
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
              >
                <ColumnAddIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="কলাম মুছুন"
                disabled={!ready}
                onClick={() => editor?.chain().focus().deleteColumn().run()}
              >
                <ColumnDeleteIcon className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="টেবিল মুছুন"
                disabled={!ready}
                onClick={() => editor?.chain().focus().deleteTable().run()}
              >
                <TableDeleteIcon className="h-4 w-4 text-(--danger)" />
              </ToolButton>
            </div>
          ) : null}

          {mode === "visual" && panel === "link" ? (
            <PanelShell label="লিংক" onClose={closePanel}>
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-start"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyLink();
                }}
              >
                <div className="min-w-0 flex-1">
                  <label htmlFor={panelInputId} className="sr-only">
                    লিংকের ঠিকানা
                  </label>
                  <input
                    id={panelInputId}
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    autoFocus
                    dir="ltr"
                    value={panelValue}
                    placeholder="https://example.com"
                    aria-invalid={panelError ? true : undefined}
                    aria-describedby={panelError ? `${panelInputId}-error` : undefined}
                    onChange={(event) => {
                      setPanelValue(event.target.value);
                      setPanelError(null);
                    }}
                    className={clsx(
                      "h-10 w-full rounded-lg border bg-(--bg) px-3 text-base text-(--text-1) outline-none placeholder:text-(--text-3) focus:ring-2 focus:ring-(--accent-soft) sm:text-sm",
                      panelError
                        ? "border-(--danger)"
                        : "border-(--border) focus:border-(--accent)",
                    )}
                  />
                  {panelError ? (
                    <p id={`${panelInputId}-error`} className="mt-1 text-xs text-(--danger)">
                      {panelError}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="submit"
                    className="h-10 flex-1 rounded-lg bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast) hover:bg-(--accent-strong) sm:flex-none"
                  >
                    প্রয়োগ করুন
                  </button>
                  {state?.link ? (
                    <button
                      type="button"
                      onClick={removeLink}
                      className="h-10 flex-1 rounded-lg border border-(--border) px-3 text-sm text-(--danger) hover:bg-(--danger-soft) sm:flex-none"
                    >
                      লিংক সরান
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closePanel}
                    className="h-10 flex-1 rounded-lg border border-(--border) px-3 text-sm text-(--text-1) hover:bg-(--surface-2) sm:flex-none"
                  >
                    বাতিল
                  </button>
                </div>
              </form>
            </PanelShell>
          ) : null}

          {mode === "visual" && panel === "math" ? (
            <PanelShell label="গাণিতিক সূত্র" onClose={closePanel}>
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyMath();
                }}
              >
                <label htmlFor={panelInputId} className="sr-only">
                  LaTeX সূত্র
                </label>
                <input
                  id={panelInputId}
                  type="text"
                  autoComplete="off"
                  autoFocus
                  dir="ltr"
                  value={panelValue}
                  placeholder="a^2 + b^2 = c^2"
                  onChange={(event) => setPanelValue(event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg) px-3 font-mono text-base text-(--text-1) outline-none placeholder:text-(--text-3) focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft) sm:text-sm"
                />
                <div className="flex shrink-0 gap-2">
                  <button
                    type="submit"
                    className="h-10 flex-1 rounded-lg bg-(--accent) px-4 text-sm font-medium text-(--accent-contrast) hover:bg-(--accent-strong) sm:flex-none"
                  >
                    {state?.math ? "হালনাগাদ করুন" : "যোগ করুন"}
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="h-10 flex-1 rounded-lg border border-(--border) px-3 text-sm text-(--text-1) hover:bg-(--surface-2) sm:flex-none"
                  >
                    বাতিল
                  </button>
                </div>
              </form>
            </PanelShell>
          ) : null}

          {mode === "visual" && panel === "citation" ? (
            <PanelShell label="সূত্রের নম্বর" onClose={closePanel}>
              <p className="px-1 pb-1.5 text-xs text-(--text-3)">
                কার্সারের জায়গায় নম্বর বসবে। নম্বর নিচের সূত্র তালিকার ক্রম অনুযায়ী।
              </p>
              <ul className="thin-scroll flex max-h-48 flex-col gap-1 overflow-y-auto">
                {sources.map((source) => (
                  <li key={source.index}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertCitation(source.index)}
                      className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm text-(--text-1) hover:bg-(--surface-2)"
                    >
                      <span className="shrink-0 rounded-md bg-(--accent-soft) px-1.5 py-0.5 text-xs font-semibold text-(--accent) tabular-nums">
                        [{source.index}]
                      </span>
                      <span className="min-w-0 break-words" dir="auto">
                        {source.reference}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </PanelShell>
          ) : null}
        </div>

        <div
          className={clsx(
            "min-w-0",
            fullscreen && "thin-scroll min-h-0 flex-1 overflow-y-auto",
            mode !== "visual" && "hidden",
          )}
        >
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div
              aria-hidden="true"
              className="animate-pulse px-4 py-3 sm:px-5"
              style={{ minHeight }}
            >
              <div className="h-4 w-3/4 rounded bg-(--surface-2)" />
              <div className="mt-3 h-4 w-1/2 rounded bg-(--surface-2)" />
            </div>
          )}
        </div>

        {mode === "markdown" ? (
          <div className={clsx("min-w-0", fullscreen && "flex min-h-0 flex-1 flex-col")}>
            <label htmlFor={`${editorId}-source`} className="sr-only">
              {`${label ?? "লেখা"} (মার্কডাউন)`}
            </label>
            <textarea
              id={`${editorId}-source`}
              dir="auto"
              value={value}
              disabled={disabled}
              spellCheck={false}
              aria-describedby={footerId}
              onChange={(event) => onChange(event.target.value)}
              className={clsx(
                "block w-full resize-y bg-transparent px-4 py-3 font-mono text-[0.95rem] leading-7 text-(--text-1) outline-none sm:px-5 sm:text-sm",
                fullscreen ? "min-h-0 flex-1 resize-none" : "min-h-(--editor-min-height)",
              )}
            />
          </div>
        ) : null}

        {mode === "preview" ? (
          <div
            className={clsx(
              "min-w-0 px-4 py-3 sm:px-5",
              fullscreen
                ? "thin-scroll min-h-0 flex-1 overflow-y-auto"
                : "min-h-(--editor-min-height)",
            )}
          >
            {value.trim() ? (
              <>
                <RichContent text={value} />
                {sources.length > 0 ? (
                  <ol className="mt-5 flex flex-wrap gap-2 border-t border-(--border) pt-4">
                    {sources.map((source) => (
                      <li
                        key={source.index}
                        className="max-w-full rounded-full border border-(--border) px-3 py-1 text-xs break-words text-(--text-2)"
                      >
                        [{source.index}] {source.reference}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-(--text-3)">
                প্রিভিউ দেখানোর মতো লেখা নেই।
              </p>
            )}
          </div>
        ) : null}

        <div
          id={footerId}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-b-xl border-t border-(--border) px-3 py-2 text-xs text-(--text-3) sm:px-4"
        >
          <span className="hidden sm:inline">
            {mode === "markdown"
              ? "মার্কডাউন লিখুন, লিখুন ট্যাবে ফিরলে বিন্যাস দেখা যাবে।"
              : `${mod}+B মোটা, ${mod}+I বাঁকা, ${mod}+K লিংক`}
          </span>
          <span
            className={clsx(
              "ms-auto tabular-nums",
              over ? "font-medium text-(--danger)" : near ? "text-(--warn)" : undefined,
            )}
          >
            শব্দ {bn(words)} · অক্ষর {bn(characters)}
            {maxLength !== undefined ? `/${bn(maxLength)}` : ""}
            {over ? " · সীমা ছাড়িয়েছে" : ""}
          </span>
        </div>
      </div>
    </div>
  );

  return fullscreen ? createPortal(frame, document.body) : frame;
}
