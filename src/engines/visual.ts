import { Editor, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, parserCtx, serializerCtx, prosePluginsCtx, rootCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { commonmark, htmlSchema, imageSchema } from '@milkdown/kit/preset/commonmark';
import { gfm, strikethroughInputRule, extendListItemSchemaForTask } from '@milkdown/kit/preset/gfm';
import { $node, $mark, $remark } from '@milkdown/kit/utils';
import type { RootContent } from 'mdast';
import type { State as MarkdownState, Info } from 'mdast-util-to-markdown';
import { baseKeymap, history, keymap, InputRule, inputRules, Plugin, PluginKey, Decoration, DecorationSet, TextSelection, closeHistory, goToNextCell, splitListItem, liftListItem, redo, undo, EditorState, type EditorView, type ProseNode } from './prose';
import { equivalentMarkdown, parseMarkdown, safeUrl, quoteMarker } from '../render/markdown';
import type { StructuralNode, SearchOptions, SearchMatch } from '../types';
import { findMatches } from '../search';
import { colorSyntax, type TextColor } from '../render/colors';

export interface VisualEngine {
  view: EditorView;
  parse(markdown: string): ProseNode;
  serialize(node: ProseNode): string;
  replace(markdown: string, reset: boolean): void;
  setReadOnly(value: boolean): void;
  search(options: SearchOptions): SearchMatch[];
  select(from: number, to?: number): void;
  replaceSearch(replacement: string, all?: boolean): void;
  destroy(): Promise<void>;
}

function safeDocument(node: ProseNode): boolean {
  let safe = true;
  node.descendants(child => {
    if (child.type.name === 'image' && !safeUrl(String(child.attrs.src), true)) safe = false;
    if (child.marks.some(mark => mark.type.name === 'link' && !safeUrl(String(mark.attrs.href)))) safe = false;
    if (child.marks.some(mark => mark.type.name === 'text_color' && !/^#[a-f0-9]{6}$/i.test(String(mark.attrs.color)))) safe = false;
  });
  return safe;
}

export async function createVisual(
  element: HTMLElement,
  structures: readonly StructuralNode[],
  readOnly: () => boolean,
  changed: (markdown: string) => void,
  selectionChanged: () => void,
  documentBase?: string,
  allowTextColors = false,
): Promise<VisualEngine> {
  let editor: Editor;
  let replacing = false;
  let query: SearchOptions = { query: '' };
  const searchKey = new PluginKey<DecorationSet>('markian-search');
  const matches = (doc: ProseNode): SearchMatch[] => {
    const found: SearchMatch[] = [];
    doc.descendants((node, position) => {
      if (!node.isTextblock) return;
      let text = '';
      let start = position + 1;
      const flush = () => { found.push(...findMatches(text, query, start)); text = ''; };
      node.forEach((child, offset) => {
        if (child.isText) { if (!text) start = position + 1 + offset; text += child.text; }
        else flush();
      });
      flush();
      return false;
    });
    return found;
  };
  const plugins = [history(), inputRules({ rules: [new InputRule(/^~{3,}([a-z0-9_+-]*)\s$/i, (state, match, start, end) => {
    if (state.selection.$from.parent.type.name !== 'paragraph') return null;
    return state.tr.delete(start, end).setBlockType(start, start, state.schema.nodes.code_block, { language: match[1] });
  }), new InputRule(/(?<![\w:/~])~~([^~]+)~~$/, (state, match, start, end) => {
    const mark = state.schema.marks.strike_through;
    return state.tr.insertText(match[1], start, end).addMark(start, start + match[1].length, mark.create()).removeStoredMark(mark);
  })] }), keymap({ ...baseKeymap, Enter: (state, dispatch, view) => {
    if (state.selection.$from.parent.type.spec.code) return baseKeymap.Enter(state, dispatch, view);
    const item = state.schema.nodes.list_item;
    return splitListItem(item)(state, dispatch, view) || liftListItem(item)(state, dispatch, view) || baseKeymap.Enter(state, dispatch, view);
  }, Tab: goToNextCell(1), 'Shift-Tab': goToNextCell(-1), 'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo }), new Plugin({
    key: searchKey,
    state: {
      init: () => DecorationSet.empty,
      apply: transaction => DecorationSet.create(transaction.doc, matches(transaction.doc).map(match => Decoration.inline(match.from, match.to, { class: 'markian-match' }))),
    },
    props: { decorations: state => searchKey.getState(state) },
  }), new Plugin({
    filterTransaction: transaction => !transaction.docChanged || (safeDocument(transaction.doc) && (replacing || !readOnly())),
  }), new Plugin({
    props: { decorations: state => {
      const decorations: Decoration[] = [];
      state.doc.descendants((node, position) => {
        if (node.type.name !== 'blockquote' || !node.firstChild?.isTextblock) return;
        const paragraph = node.firstChild;
        const marker = quoteMarker(paragraph.textBetween(0, paragraph.content.size, '\n', '\n'));
        if (!marker) return;
        decorations.push(Decoration.node(position, position + node.nodeSize, {
          'data-alert-kind': marker.kind.toLowerCase(), 'data-alert-title': marker.kind[0] + marker.kind.slice(1).toLowerCase(),
        }));
        decorations.push(Decoration.inline(position + 2, position + 2 + marker.length, { class: 'markian-alert-marker' }));
      });
      return DecorationSet.create(state.doc, decorations);
    } },
  })];
  editor = Editor.make().config(ctx => {
    ctx.set(rootCtx, element);
    ctx.set(defaultValueCtx, '');
    if (allowTextColors) ctx.update(remarkStringifyOptionsCtx, options => ({ ...options, handlers: { ...options.handlers,
      textColor: (node: TextColor, _parent: unknown, state: MarkdownState, info: Info) => `<span style="color:${node.color}">${state.containerPhrasing(node, info)}</span>`,
    } }));
    ctx.update(prosePluginsCtx, current => [...current, ...plugins]);
    ctx.update(editorViewOptionsCtx, options => ({
      ...options,
      attributes: { class: 'markian-document', 'aria-label': 'Markdown document', role: 'textbox', 'aria-multiline': 'true' },
      editable: () => !readOnly(),
      dispatchTransaction(transaction) {
        const view = ctx.get(editorViewCtx);
        const result = view.state.applyTransaction(transaction);
        view.updateState(result.state);
        if (!replacing && result.transactions.some(item => item.docChanged)) changed(ctx.get(serializerCtx)(view.state.doc));
        selectionChanged();
      },
      handleDOMEvents: {
        click: (view, event) => {
          const checkbox = (event.target as Element).closest<HTMLInputElement>('input[type="checkbox"]');
          if (checkbox) {
            event.preventDefault();
            if (readOnly()) return true;
            const item = checkbox.closest('li');
            if (!item) return false;
            const selected = view.state.doc.resolve(view.posAtDOM(item, 0));
            let depth = selected.depth;
            while (depth > 0 && selected.node(depth).type.name !== 'list_item') depth--;
            if (depth) {
              const node = selected.node(depth);
              view.dispatch(closeHistory(view.state.tr.setNodeMarkup(selected.before(depth), undefined, { ...node.attrs, checked: !node.attrs.checked })));
            }
            return true;
          }
          const anchor = (event.target as Element).closest('a');
          if (!anchor) return false;
          const mouse = event as MouseEvent;
          if (!safeUrl(anchor.getAttribute('href') ?? '') || !(mouse.ctrlKey || mouse.metaKey)) event.preventDefault();
          return true;
        },
      },
    }));
  });
  for (const structure of structures) {
    editor.use($node(structure.id, () => ({
      ...structure.schema,
      parseMarkdown: {
        match: node => structure.fromMarkdown(node as RootContent) !== null,
        runner: (state, node, type) => { state.addNode(type, structure.fromMarkdown(node as RootContent) ?? {}); },
      },
      toMarkdown: {
        match: node => node.type.name === structure.id,
        runner: (state, node) => {
          const markdown = structure.toMarkdown(node);
          state.addNode(markdown.type, undefined, 'value' in markdown ? markdown.value : undefined);
        },
      },
    })));
  }
  if (allowTextColors) {
    editor.use($remark('markian-colors', () => colorSyntax));
    editor.use($mark('text_color', () => ({
      attrs: { color: { default: '#262c2b', validate: 'string' } },
      parseDOM: [{ tag: 'span[style]', getAttrs: node => {
        const color = (node as HTMLElement).style.color;
        const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        return match ? { color: '#' + match.slice(1).map(value => Number(value).toString(16).padStart(2, '0')).join('') } : false;
      } }],
      toDOM: mark => ['span', { style: `color:${mark.attrs.color}` }, 0],
      parseMarkdown: {
        match: node => node.type === 'textColor',
        runner: (state, node, type) => { state.openMark(type, { color: node.color }); state.next(node.children); state.closeMark(type); },
      },
      toMarkdown: { match: mark => mark.type.name === 'text_color', runner: (state, mark) => { state.withMark(mark, 'textColor', undefined, { color: mark.attrs.color }); } },
    })));
  }
  editor.use(commonmark).use(gfm.filter(plugin => plugin !== strikethroughInputRule)).use(extendListItemSchemaForTask.extendSchema(previous => ctx => ({
    ...previous(ctx),
    toDOM: node => node.attrs.checked === null ? previous(ctx).toDOM!(node) : ['li', {
      'data-item-type': 'task', 'data-checked': String(node.attrs.checked), 'data-label': node.attrs.label, 'data-list-type': node.attrs.listType, 'data-spread': String(node.attrs.spread),
    }, ['input', { type: 'checkbox', checked: node.attrs.checked ? 'checked' : null, disabled: readOnly() ? 'disabled' : null, contenteditable: 'false', 'aria-label': 'Toggle task' }], ['div', 0]],
  }))).use(imageSchema.extendSchema(previous => ctx => ({
    ...previous(ctx),
    toDOM: node => ['img', { ...node.attrs, src: documentBase && safeUrl(String(node.attrs.src), true) ? new URL(String(node.attrs.src), new URL(documentBase, element.ownerDocument.baseURI)).href : node.attrs.src }],
  }))).use(htmlSchema.extendSchema(previous => ctx => ({
    ...previous(ctx),
    toDOM: node => ['span', { class: 'markian-opaque', hidden: /^\s*<!--/.test(String(node.attrs.value)), contenteditable: 'false' }, String(node.attrs.value)],
  })));
  try { await editor.create(); } catch (error) { await editor.destroy(); throw error; }
  const view = editor.action(ctx => ctx.get(editorViewCtx));
  const serialize = (node: ProseNode): string => editor.action(ctx => ctx.get(serializerCtx)(node));
  const parse = (markdown: string): ProseNode => {
    parseMarkdown(markdown);
    const node = editor.action(ctx => ctx.get(parserCtx)(markdown));
    if (!safeDocument(node)) throw new Error('Unsafe URLs cannot be opened in visual mode. Source has been retained.');
    if (!equivalentMarkdown(markdown, serialize(node))) throw new Error('This document contains content not supported by visual mode. Source has been retained.');
    return node;
  };
  return {
    view, parse, serialize,
    replace(markdown, reset) {
      const doc = parse(markdown);
      replacing = true;
      try {
        if (reset) view.updateState(EditorState.create({ schema: view.state.schema, doc, plugins: view.state.plugins }));
        else view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content));
      } finally { replacing = false; }
    },
    setReadOnly: () => {
      view.setProps({ editable: () => !readOnly() });
      for (const checkbox of element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) checkbox.disabled = readOnly();
    },
    search(options) { query = options; view.dispatch(view.state.tr.setMeta('search', true)); return matches(view.state.doc); },
    select(from, to = from) { view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)).scrollIntoView()); },
    replaceSearch(replacement, all = false) {
      if (readOnly()) return;
      const selection = view.state.selection;
      const selected = matches(view.state.doc).filter(match => all || (match.from === selection.from && match.to === selection.to));
      const transaction = closeHistory(view.state.tr);
      for (const match of selected.reverse()) {
        const marks = view.state.doc.resolve(match.from).marks();
        transaction.replaceWith(match.from, match.to, replacement ? view.state.schema.text(replacement, marks) : []);
      }
      if (transaction.docChanged) view.dispatch(transaction);
    },
    destroy: async () => { await editor.destroy(); },
  };
}