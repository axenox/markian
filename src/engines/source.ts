import { EditorState, Compartment, StateEffect, StateField } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection, Decoration } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, isolateHistory, invertedEffects, undo, redo, indentMore, indentLess, indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { search, SearchQuery, setSearchQuery } from '@codemirror/search';
import { findMatches } from '../search';
import type { SearchMatch, SearchOptions, SourceOptions, SourceToken } from '../types';

const languageEffect = StateEffect.define<string>();
const languageField = StateField.define<string>({
  create: () => '',
  update: (value, transaction) => transaction.effects.find(effect => effect.is(languageEffect))?.value ?? value,
});

export class SourceEditor {
  readonly view: EditorView;
  private permissions = new Compartment();
  private highlights = new Compartment();
  private searchHighlights = new Compartment();
  private query: SearchOptions = { query: '' };

  constructor(element: HTMLElement, value: string, readOnly: boolean, changed: (value: string) => void, selected: () => void = () => {}, options: SourceOptions = {}) {
    const tabWidth = options.tabWidth ?? 2;
    if (!Number.isInteger(tabWidth) || tabWidth < 1 || tabWidth > 8) throw new TypeError('Source tabWidth must be an integer from 1 to 8.');
    this.view = new EditorView({
      parent: element,
      state: EditorState.create({ doc: value, extensions: [
        history(), lineNumbers(), drawSelection(), search(), keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorState.tabSize.of(tabWidth), indentUnit.of(' '.repeat(tabWidth)), languageField.init(() => options.language ?? ''),
        invertedEffects.of(transaction => transaction.effects.some(effect => effect.is(languageEffect)) ? [languageEffect.of(transaction.startState.field(languageField))] : []),
        this.highlights.of([]),
        this.searchHighlights.of([]),
        this.permissions.of(EditorState.readOnly.of(readOnly)),
        EditorView.contentAttributes.of({ 'aria-label': options.label ?? 'Markdown source' }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) { this.setHighlights([]); changed(update.state.doc.toString()); }
          if (update.state.field(languageField) !== update.startState.field(languageField)) options.onLanguageChange?.(update.state.field(languageField));
          if (update.selectionSet) selected();
        }),
        EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--markian-mono)' }, '.cm-content': { padding: '20px 12px' } }),
      ] }),
    });
  }

  get(): string { return this.view.state.doc.toString(); }
  getLanguage(): string { return this.view.state.field(languageField); }
  setLanguage(language: string): void {
    if (!this.view.state.readOnly && language !== this.getLanguage()) this.view.dispatch({ effects: languageEffect.of(language), annotations: isolateHistory.of('full') });
  }
  setHighlights(tokens: readonly SourceToken[]): void {
    const ranges = tokens.map(token => {
      if (!Number.isInteger(token.from) || !Number.isInteger(token.to) || token.from < 0 || token.to <= token.from || token.to > this.view.state.doc.length || !/^tok-[a-z-]+(?: tok-[a-z-]+)*$/.test(token.className)) throw new TypeError('Invalid source highlighting token.');
      return Decoration.mark({ class: token.className }).range(token.from, token.to);
    });
    this.view.dispatch({ effects: this.highlights.reconfigure(EditorView.decorations.of(Decoration.set(ranges, true))) });
  }
  /** Highlights matches and the actual selection while Markian's search panel owns focus. */
  search(options: SearchOptions): SearchMatch[] {
    this.query = options;
    this.view.dispatch({ effects: [
      setSearchQuery.of(new SearchQuery({ search: options.query, caseSensitive: options.caseSensitive, wholeWord: options.wholeWord, literal: true })),
      this.searchHighlights.reconfigure(options.query ? EditorView.decorations.compute(['doc', 'selection'], state => Decoration.set(
        findMatches(state.doc.toString(), options).map(match => Decoration.mark({
          class: state.selection.ranges.some(range => range.from === match.from && range.to === match.to) ? 'markian-match markian-match-current' : 'markian-match',
        }).range(match.from, match.to)),
      )) : []),
    ] });
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
  indent(outdent = false): void { if (!this.view.state.readOnly) (outdent ? indentLess : indentMore)(this.view); }
  setReadOnly(value: boolean): void { this.view.dispatch({ effects: this.permissions.reconfigure(EditorState.readOnly.of(value)) }); }
  focus(): void { this.view.focus(); }
  destroy(): void { this.view.destroy(); }
}