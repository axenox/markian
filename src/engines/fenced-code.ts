/** Visual fence controls retain ProseMirror ownership of literal code and undoable language metadata. */
import { Plugin, PluginKey, TextSelection, closeHistory, undo, redo, type EditorView, type ProseNode } from './prose';
import { expandTabs, indentationChanges } from './indentation';

const draftKey = new PluginKey<number | null>('markian-fence-draft');

export const fenceDraftMeta = 'markian-new-fence';

export function fencedCodeEditing(readOnly: () => boolean, tabWidth: number, rendered: WeakSet<Node>, translate: (key: string) => string) {
  let releaseTab = false;
  const surfaces = new Set<() => void>();
  const keyHandlers = new Set<(event: KeyboardEvent) => boolean>();
  const plugin = new Plugin<number | null>({
    key: draftKey,
    state: {
      init: () => null,
      apply(transaction, previous) {
        const created = transaction.getMeta(fenceDraftMeta) as number | undefined;
        const position = created ?? (previous === null ? null : transaction.mapping.map(previous, 1));
        if (position === null) return null;
        const node = transaction.doc.nodeAt(position);
        return node?.type.name === 'code_block' && transaction.selection.from >= position + 1
          && transaction.selection.to <= position + node.nodeSize - 1 ? position : null;
      },
    },
    props: {
      handleDOMEvents: { focus: () => { queueMicrotask(() => surfaces.forEach(sync => sync())); return false; } },
      handleKeyDown(view, event) {
        const { state } = view;
        const { selection } = state;
        const inCode = selection instanceof TextSelection && selection.$from.sameParent(selection.$to) && selection.$from.parent.type.name === 'code_block';
        const released = releaseTab;
        releaseTab = event.key === 'Escape' && inCode;
        if (inCode && event.key === 'Enter' && !readOnly() && !view.composing
          && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const line = selection.$from.parent.textContent.slice(0, selection.$from.parentOffset).split('\n').at(-1)!;
          const indentation = expandTabs(line.match(/^[ \t]*/)![0], tabWidth);
          view.dispatch(closeHistory(state.tr).insertText('\n' + indentation).scrollIntoView());
          return true;
        }
        if (!inCode && selection instanceof TextSelection && selection.empty && !readOnly() && !view.composing
          && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
          const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
          const head = selection.$head;
          const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
          const atEdge = horizontal ? head.parentOffset === (forward ? head.parent.content.size : 0)
            : (forward || backward) && view.endOfTextblock(forward ? 'down' : 'up');
          if ((forward || backward) && atEdge && head.depth > 0) {
            const boundary = forward ? head.after() : head.before();
            const adjacent = forward ? state.doc.resolve(boundary).nodeAfter : state.doc.resolve(boundary).nodeBefore;
            const position = forward ? boundary : boundary - (adjacent?.nodeSize ?? 0);
            const dom = view.nodeDOM(position);
            if (adjacent?.type.name === 'code_block' && dom && !rendered.has(dom)) {
              const target = forward ? position + 1 : position + adjacent.nodeSize - 1;
              view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, target)).scrollIntoView());
              return true;
            }
          }
        }
        if (inCode && event.key === 'Tab' && !released && !readOnly() && !view.composing && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const start = selection.$from.start();
          const changes = indentationChanges(selection.$from.parent.textContent, selection.from - start, selection.to - start, tabWidth, event.shiftKey);
          const transaction = closeHistory(state.tr);
          for (const change of changes.reverse()) transaction.insertText(change.insert, start + change.from, start + change.to);
          transaction.setSelection(TextSelection.create(transaction.doc, transaction.mapping.map(selection.anchor), transaction.mapping.map(selection.head)));
          view.dispatch(transaction.scrollIntoView());
          return true;
        }
        return Array.from(keyHandlers).some(handle => handle(event));
      },
      handleTextInput(view, from, to, text) {
        const position = view.state.doc.resolve(from);
        if (readOnly() || position.parent.type.name !== 'code_block' || !text.includes('\t')) return false;
        const prefix = position.parent.textContent.slice(0, position.parentOffset).split('\n').at(-1)!;
        view.dispatch(view.state.tr.insertText(expandTabs(text, tabWidth, expandTabs(prefix, tabWidth).length), from, to));
        return true;
      },
      handlePaste(view, event) {
        const { selection } = view.state;
        const text = event.clipboardData?.getData('text/plain');
        if (readOnly() || !text?.includes('\t') || !selection.$from.sameParent(selection.$to) || selection.$from.parent.type.name !== 'code_block') return false;
        const prefix = selection.$from.parent.textContent.slice(0, selection.$from.parentOffset).split('\n').at(-1)!;
        view.dispatch(closeHistory(view.state.tr).insertText(expandTabs(text.replace(/\r\n?/g, '\n'), tabWidth, expandTabs(prefix, tabWidth).length)).scrollIntoView());
        return true;
      },
    },
    view: () => ({ update: () => surfaces.forEach(sync => sync()) }),
  });
  const nodeView = (
    initial: ProseNode,
    view: EditorView,
    getPos: () => number | undefined,
    render: (node: ProseNode, element: HTMLElement) => (() => void) | undefined,
  ) => {
    const document = view.dom.ownerDocument;
    const dom = document.createElement('pre');
    dom.className = 'markian-fenced-code';
    dom.style.tabSize = String(tabWidth);
    const opening = document.createElement('span');
    opening.className = 'markian-code-fence markian-code-fence-opening';
    opening.contentEditable = 'false';
    const ticks = document.createElement('span');
    const language = document.createElement('input');
    language.className = 'markian-code-language';
    language.setAttribute('aria-label', translate('CODE.LANGUAGE_FIELD'));
    language.setAttribute('autocomplete', 'off');
    language.setAttribute('spellcheck', 'false');
    language.maxLength = 80;
    opening.append(ticks, language);
    const content = document.createElement('code');
    const preview = document.createElement('div');
    preview.contentEditable = 'false';
    preview.className = 'markian-code-rendering';
    const closing = document.createElement('span');
    closing.className = 'markian-code-fence markian-code-fence-closing';
    closing.contentEditable = 'false';
    closing.tabIndex = 0;
    closing.setAttribute('role', 'button');
    closing.setAttribute('aria-label', translate('CODE.CLOSING_FENCE'));
    dom.append(opening, content, preview, closing);
    let node = initial;
    let dispose: (() => void) | undefined;
    let presentation = '';
    let destroyed = false;
    let finalizedMermaid = false;
    const selectBody = (end: boolean) => {
      const position = getPos();
      if (position === undefined) return;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position + (end ? node.nodeSize - 1 : 1))));
      view.focus();
    };
    const leave = (before: boolean) => {
      const position = getPos();
      if (position === undefined || readOnly()) return;
      const { state } = view;
      const boundary = before ? position : position + node.nodeSize;
      const resolved = state.doc.resolve(boundary);
      const adjacent = before ? resolved.nodeBefore : resolved.nodeAfter;
      const transaction = closeHistory(state.tr);
      if (!adjacent?.isTextblock || adjacent.type.spec.code) {
        const paragraph = state.schema.nodes.paragraph.create();
        if (!resolved.parent.canReplaceWith(resolved.index(), resolved.index(), paragraph.type)) return;
        transaction.insert(boundary, paragraph);
        transaction.setSelection(TextSelection.create(transaction.doc, boundary + 1));
      } else {
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(boundary), before ? -1 : 1));
      }
      view.dispatch(transaction.scrollIntoView());
      view.focus();
    };
    const sync = () => {
      if (destroyed) return;
      const position = getPos();
      if (position === undefined) return;
      const selection = view.state.selection;
      const active = !readOnly() && (view.hasFocus() || dom.contains(document.activeElement))
        && selection.from >= position + 1 && selection.to <= position + node.nodeSize - 1;
      const draft = draftKey.getState(view.state) === position;
      const mermaid = String(node.attrs.language).toLowerCase() === 'mermaid';
      if (!mermaid) finalizedMermaid = false;
      const editable = active && (!mermaid || (draft && !finalizedMermaid));
      const signature = JSON.stringify([node.textContent, node.attrs.language, editable]);
      if (signature !== presentation) {
        presentation = signature;
        dispose?.();
        dispose = undefined;
        preview.replaceChildren();
        if (!editable) dispose = render(node, preview);
      }
      const locked = Boolean(dispose) && mermaid;
      if (locked) finalizedMermaid = true;
      if (locked) { rendered.add(dom); dom.contentEditable = 'false'; }
      else { rendered.delete(dom); dom.removeAttribute('contenteditable'); }
      dom.dataset.fenceActive = String(editable || (!dispose && active));
      opening.hidden = closing.hidden = dom.dataset.fenceActive !== 'true';
      preview.hidden = !dispose;
      content.hidden = Boolean(dispose);
      content.className = dispose ? '' : `language-${String(node.attrs.language ?? '')}`;
      const fence = '`'.repeat((node.textContent.match(/`+/g) ?? []).reduce((size, run) => Math.max(size, run.length + 1), 3));
      ticks.textContent = closing.textContent = fence;
      if (language.value !== String(node.attrs.language ?? '')) language.value = String(node.attrs.language ?? '');
      language.style.width = `${Math.max(1, language.value.length + 1)}ch`;
      language.disabled = readOnly();
    };
    language.addEventListener('focus', () => {
      const position = getPos();
      if (position !== undefined && !readOnly()) view.dispatch(closeHistory(view.state.tr).setSelection(TextSelection.create(view.state.doc, position + 1)));
    });
    language.addEventListener('input', () => {
      if (readOnly()) { sync(); return; }
      const value = language.value.replace(/[\s`~]/g, '');
      language.value = value;
      const position = getPos();
      if (position !== undefined) view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, language: value }).setMeta(fenceDraftMeta, position));
    });
    language.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        if (!readOnly()) (event.key.toLowerCase() === 'y' || event.shiftKey ? redo : undo)(view.state, view.dispatch);
      } else if (event.key === 'Enter' || event.key === 'ArrowDown') { event.preventDefault(); selectBody(false); }
      else if (event.key === 'ArrowLeft' && language.selectionStart === 0 && language.selectionEnd === 0) { event.preventDefault(); leave(true); }
    });
    ticks.addEventListener('pointerdown', event => {
      if (event.button !== 0 || readOnly()) return;
      event.preventDefault();
      if (event.clientX < ticks.getBoundingClientRect().left + ticks.getBoundingClientRect().width / 2) leave(true);
      else language.focus();
    });
    closing.addEventListener('pointerdown', event => {
      if (event.button !== 0 || readOnly()) return;
      event.preventDefault();
      leave(false);
    });
    closing.addEventListener('keydown', event => {
      if (['Enter', 'ArrowDown', 'ArrowRight'].includes(event.key)) { event.preventDefault(); leave(false); }
      else if (['ArrowUp', 'ArrowLeft', 'Backspace'].includes(event.key)) { event.preventDefault(); selectBody(true); }
    });
    preview.addEventListener('pointerdown', event => {
      if (event.button !== 0 || readOnly() || String(node.attrs.language).toLowerCase() === 'mermaid'
        || (event.target as Element).closest('button')) return;
      event.preventDefault();
      const code = preview.querySelector('code');
      const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
      const range = caret ? null : document.caretRangeFromPoint?.(event.clientX, event.clientY);
      const container = caret?.offsetNode ?? range?.startContainer;
      const offset = caret?.offset ?? range?.startOffset;
      let textOffset = 0;
      if (code && container && offset !== undefined && code.contains(container)) {
        const prefix = document.createRange();
        prefix.setStart(code, 0);
        prefix.setEnd(container, offset);
        textOffset = prefix.toString().length;
      }
      const position = getPos();
      if (position === undefined) return;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position + 1 + Math.min(textOffset, node.content.size))));
      view.focus();
    });
    const handleKeyDown = (event: KeyboardEvent): boolean => {
      const position = getPos();
      const { state } = view;
      const lineEdge = event.key === 'Home' || event.key === 'End';
      if (position === undefined || state.selection.$head.parent.type.name !== 'code_block'
        || state.selection.$head.before() !== position || view.composing || readOnly()
        || (event.shiftKey && !lineEdge) || event.ctrlKey || event.metaKey || event.altKey || (!state.selection.empty && !lineEdge)) return false;
      const offset = state.selection.$head.parentOffset;
      const text = node.textContent;
      if (lineEdge) {
        const nextLine = text.indexOf('\n', offset);
        const lineStart = offset === 0 ? 0 : text.lastIndexOf('\n', offset - 1) + 1;
        const lineEnd = nextLine < 0 ? text.length : nextLine;
        const target = position + 1 + (event.key === 'Home' ? lineStart : lineEnd);
        view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, event.shiftKey ? state.selection.anchor : target, target)));
      } else if (event.key === 'ArrowRight' && offset === text.length) {
        event.preventDefault();
        leave(false);
      } else if (event.key === 'ArrowDown' && !text.slice(offset).includes('\n')) {
        event.preventDefault();
        closing.focus();
      } else if (event.key === 'ArrowUp' && !text.slice(0, offset).includes('\n')) {
        event.preventDefault();
        language.focus();
        language.setSelectionRange(language.value.length, language.value.length);
      } else if (event.key === 'ArrowLeft' && offset === 0) {
        event.preventDefault();
        leave(true);
      } else if ((event.key === 'Backspace' && offset === 0) || (event.key === 'Delete' && offset === text.length)) {
        event.preventDefault();
      } else return false;
      return true;
    };
    surfaces.add(sync);
    keyHandlers.add(handleKeyDown);
    sync();
    return {
      dom, contentDOM: content,
      update(updated: ProseNode) {
        if (updated.type !== node.type) return false;
        node = updated;
        sync();
        return true;
      },
      stopEvent: (event: Event) => !content.contains(event.target as Node),
      ignoreMutation: (mutation: MutationRecord | { type: 'selection'; target: Node }) => mutation.type !== 'selection'
        && (mutation.target === dom || (mutation.type === 'attributes' && mutation.target === content) || !content.contains(mutation.target)),
      destroy() { destroyed = true; surfaces.delete(sync); keyHandlers.delete(handleKeyDown); dispose?.(); },
    };
  };
  return { plugin, nodeView };
}
