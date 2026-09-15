import type { Editor } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isArabicDominant } from "@/lib/ai/answerText";

interface ArabicState {
  pending: number | null;
  decorations: DecorationSet;
}

interface ArabicMeta {
  pending: number | null;
}

export const arabicBlocksKey = new PluginKey<ArabicState>("arabicBlocks");

const ARABIC_ATTRS = { class: "arabic", dir: "rtl" };

function decorate(doc: ProseNode, pending: number | null): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "listItem") {
      const first = node.firstChild;
      if (first?.isTextblock && isArabicDominant(first.textContent)) {
        decorations.push(Decoration.node(pos, pos + node.nodeSize, ARABIC_ATTRS));
      }
      return true;
    }
    if (!node.isTextblock) return true;
    if (node.type.spec.code) return false;
    const arabic =
      isArabicDominant(node.textContent) || (pos === pending && node.content.size === 0);
    if (arabic) decorations.push(Decoration.node(pos, pos + node.nodeSize, ARABIC_ATTRS));
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

function validPending(doc: ProseNode, pending: number | null): number | null {
  if (pending === null || pending < 0 || pending >= doc.content.size) return null;
  const node = doc.nodeAt(pending);
  return node?.isTextblock && node.content.size === 0 ? pending : null;
}

export function arabicBlocksPlugin(): Plugin<ArabicState> {
  return new Plugin<ArabicState>({
    key: arabicBlocksKey,
    state: {
      init: (_, state) => ({ pending: null, decorations: decorate(state.doc, null) }),
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(arabicBlocksKey) as ArabicMeta | undefined;
        let pending = value.pending;
        if (meta) {
          pending = meta.pending;
        } else if (pending !== null && tr.docChanged) {
          const mapped = tr.mapping.mapResult(pending);
          pending = mapped.deleted ? null : mapped.pos;
        }
        pending = validPending(state.doc, pending);
        if (!tr.docChanged && pending === value.pending) return value;
        return { pending, decorations: decorate(state.doc, pending) };
      },
    },
    props: {
      decorations: (state) => arabicBlocksKey.getState(state)?.decorations ?? null,
    },
  });
}

function currentTextblockStart(state: EditorState): number | null {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) return null;
  return $from.before();
}

export function isArabicBlockActive(state: EditorState): boolean {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false;
  if (isArabicDominant($from.parent.textContent)) return true;
  return arabicBlocksKey.getState(state)?.pending === currentTextblockStart(state);
}

function markPending(editor: Editor) {
  const start = currentTextblockStart(editor.state);
  editor.view.dispatch(editor.state.tr.setMeta(arabicBlocksKey, { pending: start }));
  editor.view.focus();
}

export function toggleArabicBlock(editor: Editor): void {
  const { state } = editor;
  const { selection } = state;
  const { $from, $to } = selection;
  const parent = $from.parent;
  if (!parent.isTextblock || parent.type.spec.code) return;

  const pending = arabicBlocksKey.getState(state)?.pending ?? null;
  if (pending !== null && pending === currentTextblockStart(state)) {
    editor.view.dispatch(state.tr.setMeta(arabicBlocksKey, { pending: null }));
    editor.view.focus();
    return;
  }

  if (!selection.empty) {
    if (!$from.sameParent($to)) return;
    const atEnd = $to.parentOffset === parent.content.size;
    const atStart = $from.parentOffset === 0;
    const chain = editor.chain().focus();
    if (!atEnd) chain.setTextSelection($to.pos).splitBlock({ keepMarks: false });
    if (!atStart) chain.setTextSelection($from.pos).splitBlock({ keepMarks: false });
    chain.run();
    return;
  }

  if (parent.content.size === 0) {
    markPending(editor);
    return;
  }

  if (isArabicDominant(parent.textContent)) return;

  editor
    .chain()
    .focus()
    .setTextSelection($from.end())
    .first(({ commands }) => [
      () => commands.splitListItem("listItem"),
      () => commands.splitBlock({ keepMarks: false }),
    ])
    .run();
  markPending(editor);
}
