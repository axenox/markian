/** Selection-local inline-code delimiters; decorations never enter Markdown or the clipboard. */
import { Decoration, DecorationSet, Plugin, TextSelection, type EditorState, type EditorView } from './prose';

interface CodeRange { from: number; to: number; text: string }

function codeRange(state: EditorState, requireActive = true): CodeRange | null {
  const { selection, schema } = state;
  const position = selection.$head;
  const code = schema.marks.inlineCode;
  if (!(selection instanceof TextSelection)) return null;
  if (requireActive && selection.empty && !(state.storedMarks ?? position.marks()).some(mark => mark.type === code)) return null;
  let range: CodeRange | null = null;
  let current: CodeRange | null = null;
  position.parent.forEach((node, offset) => {
    const from = position.start() + offset;
    if (node.isText && code.isInSet(node.marks)) {
      if (current) { current.to = from + node.nodeSize; current.text += node.text; }
      else current = { from, to: from + node.nodeSize, text: node.text ?? '' };
      if (selection.from >= current.from && selection.to <= current.to) range = current;
    } else current = null;
  });
  return range;
}

export function inlineCodeBoundaries(readOnly: () => boolean): Plugin {
  return new Plugin({
    appendTransaction(transactions, previous, state) {
      if (readOnly() || !state.selection.empty) return null;
      const range = codeRange(previous, false);
      if (!range) return null;
      let { from, to } = range;
      let deleted = false;
      let onlyCodeDeletion = true;
      for (const transaction of transactions) for (const map of transaction.mapping.maps) {
        map.forEach((start, end, newStart, newEnd) => {
          if (start < from || end > to || start === end || newStart !== newEnd) onlyCodeDeletion = false;
          else deleted = true;
        });
        from = map.map(from, -1);
        to = map.map(to, 1);
      }
      if (!deleted || !onlyCodeDeletion || from >= to || state.selection.from < from || state.selection.to > to) return null;
      const position = state.selection.$from;
      const code = state.schema.marks.inlineCode;
      if (!code.isInSet(position.nodeBefore?.marks ?? []) && !code.isInSet(position.nodeAfter?.marks ?? [])) return null;
      const wasInside = !previous.selection.empty
        || Boolean(code.isInSet(previous.storedMarks ?? previous.selection.$head.marks()));
      const isInside = Boolean(code.isInSet(state.storedMarks ?? position.marks()));
      if (wasInside === isInside) return null;
      // Native deletion can flip which side of a noninclusive boundary the caret belongs to.
      return wasInside ? state.tr.addStoredMark(code.create()) : state.tr.removeStoredMark(code);
    },
    props: {
      handleClick(view, position, event) {
        const element = (event.target as Element).closest('code');
        if (readOnly() || !element || element.closest('pre')) return false;
        const { state } = view;
        const code = state.schema.marks.inlineCode;
        const resolved = state.doc.resolve(position);
        if (!code.isInSet(resolved.nodeBefore?.marks ?? []) && !code.isInSet(resolved.nodeAfter?.marks ?? [])) return false;
        // A one-character span has no interior position where a noninclusive mark is inferred.
        view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, position))
          .setStoredMarks(code.create().addToSet(resolved.marks())));
        return true;
      },
      decorations(state) {
        if (readOnly()) return null;
        const range = codeRange(state);
        if (!range) return null;
        const ticks = '`'.repeat((range.text.match(/`+/g) ?? []).reduce((length, run) => Math.max(length, run.length + 1), 1));
        const padding = /^`|`$/.test(range.text) || (/^ .* $/.test(range.text) && /[^ ]/.test(range.text)) ? ' ' : '';
        const marker = (opening: boolean) => (view: EditorView, getPos: () => number | undefined) => {
          const element = view.dom.ownerDocument.createElement('span');
          element.className = 'markian-inline-code-marker';
          element.dataset.edge = opening ? 'start' : 'end';
          element.setAttribute('aria-hidden', 'true');
          element.textContent = opening ? ticks + padding : padding + ticks;
          element.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            const position = getPos();
            if (position === undefined) return;
            event.preventDefault();
            const bounds = element.getBoundingClientRect();
            const inside = opening === (event.clientX >= bounds.left + bounds.width / 2);
            const { state } = view;
            const code = state.schema.marks.inlineCode;
            const marks = state.doc.resolve(opening ? position + 1 : position).marks();
            view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, position))
              .setStoredMarks(inside ? code.create().addToSet(marks) : code.removeFromSet(marks)));
            view.focus();
          });
          return element;
        };
        // Keep the native caret between the widgets while typing inside the mark.
        return DecorationSet.create(state.doc, [
          Decoration.widget(range.from, marker(true), { key: `code-start-${ticks}-${padding}`, side: -1, ignoreSelection: true }),
          Decoration.widget(range.to, marker(false), { key: `code-end-${ticks}-${padding}`, side: 1, ignoreSelection: true }),
        ]);
      },
      handleKeyDown(view, event) {
        if (readOnly() || view.composing || !['ArrowLeft', 'ArrowRight'].includes(event.key)
          || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
        const { state } = view;
        if (!state.selection.empty) return false;
        const position = state.selection.$from;
        const code = state.schema.marks.inlineCode;
        const marks = state.storedMarks ?? position.marks();
        const inside = Boolean(code.isInSet(marks));
        const before = Boolean(position.nodeBefore && code.isInSet(position.nodeBefore.marks));
        const after = Boolean(position.nodeAfter && code.isInSet(position.nodeAfter.marks));
        const right = event.key === 'ArrowRight';
        if (inside && (right ? before && !after : after && !before)) {
          view.dispatch(state.tr.removeStoredMark(code));
          return true;
        }
        if (!inside && (right ? after && !before : before && !after)) {
          view.dispatch(state.tr.addStoredMark(code.create()));
          return true;
        }
        const range = inside ? codeRange(state) : null;
        const character = range && (right ? Array.from(range.text).at(-1) : Array.from(range.text)[0]);
        const boundary = range && (right ? range.to : range.from);
        if (character && boundary !== null && position.pos + (right ? character.length : -character.length) === boundary) {
          view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, boundary)).setStoredMarks(marks));
          return true;
        }
        return false;
      },
    },
  });
}
