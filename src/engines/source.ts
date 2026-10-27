import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, isolateHistory, undo, redo } from '@codemirror/commands';
import { search, SearchQuery, setSearchQuery } from '@codemirror/search';
import { findMatches } from '../search';
import type { SearchMatch, SearchOptions } from '../types';

export class SourceEditor {
  readonly view: EditorView;
  private permissions = new Compartment();
  private query: SearchOptions = { query: '' };

  constructor(element: HTMLElement, value: string, readOnly: boolean, changed: (value: string) => void, selected: () => void = () => {}) {
    this.view = new EditorView({
      parent: element,
      state: EditorState.create({ doc: value, extensions: [
        history(), lineNumbers(), drawSelection(), search(), keymap.of([...defaultKeymap, ...historyKeymap]),
        this.permissions.of(EditorState.readOnly.of(readOnly)),
        EditorView.contentAttributes.of({ 'aria-label': 'Markdown source' }),
        EditorView.updateListener.of(update => { if (update.docChanged) changed(update.state.doc.toString()); if (update.selectionSet) selected(); }),
        EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--markian-mono)' }, '.cm-content': { padding: '20px 12px' } }),
      ] }),
    });
  }

  get(): string { return this.view.state.doc.toString(); }
  search(options: SearchOptions): SearchMatch[] {
    this.query = options;
    this.view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: options.query, caseSensitive: options.caseSensitive, wholeWord: options.wholeWord, literal: true })) });
    return findMatches(this.get(), options);
  }
  select(from: number, to = from): void {
    this.view.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: 'center' }) });
  }
  replaceSearch(replacement: string, all = false): void {
    if (this.view.state.readOnly) return;
    const selection = this.view.state.selection.main;
    const matches = findMatches(this.get(), this.query);
    const selected = all ? matches : matches.filter(match => match.from === selection.from && match.to === selection.to);
    this.view.dispatch({ changes: selected.map(match => ({ ...match, insert: replacement })), annotations: isolateHistory.of('full'), userEvent: 'input.replace' });
  }
  undo(): void { undo(this.view); }
  redo(): void { redo(this.view); }
  setReadOnly(value: boolean): void { this.view.dispatch({ effects: this.permissions.reconfigure(EditorState.readOnly.of(value)) }); }
  focus(): void { this.view.focus(); }
  destroy(): void { this.view.destroy(); }
}