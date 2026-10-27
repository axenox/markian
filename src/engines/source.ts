import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';

export class SourceEditor {
  readonly view: EditorView;
  private permissions = new Compartment();

  constructor(element: HTMLElement, value: string, readOnly: boolean, changed: (value: string) => void) {
    this.view = new EditorView({
      parent: element,
      state: EditorState.create({ doc: value, extensions: [
        history(), lineNumbers(), drawSelection(), keymap.of([...defaultKeymap, ...historyKeymap]),
        this.permissions.of(EditorState.readOnly.of(readOnly)),
        EditorView.contentAttributes.of({ 'aria-label': 'Markdown source' }),
        EditorView.updateListener.of(update => { if (update.docChanged) changed(update.state.doc.toString()); }),
        EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--markian-mono)' }, '.cm-content': { padding: '20px 12px' } }),
      ] }),
    });
  }

  get(): string { return this.view.state.doc.toString(); }
  undo(): void { undo(this.view); }
  redo(): void { redo(this.view); }
  setReadOnly(value: boolean): void { this.view.dispatch({ effects: this.permissions.reconfigure(EditorState.readOnly.of(value)) }); }
  focus(): void { this.view.focus(); }
  destroy(): void { this.view.destroy(); }
}