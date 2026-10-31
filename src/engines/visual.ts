import { Editor, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, parserCtx, serializerCtx, prosePluginsCtx, rootCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { commonmark, htmlSchema, imageSchema } from '@milkdown/kit/preset/commonmark';
import { gfm, strikethroughInputRule, extendListItemSchemaForTask } from '@milkdown/kit/preset/gfm';
import { $node, $mark, $remark } from '@milkdown/kit/utils';
import type { RootContent } from 'mdast';
import type { State as MarkdownState, Info } from 'mdast-util-to-markdown';
import Papa from 'papaparse';
import { CellSelection, Fragment, Slice, TableMap, selectedRect } from './prose';
import { baseKeymap, history, keymap, InputRule, inputRules, Plugin, PluginKey, Decoration, DecorationSet, TextSelection, closeHistory, goToNextCell, splitListItem, liftListItem, redo, undo, EditorState, type EditorView, type ProseNode } from './prose';
import { equivalentMarkdown, markdownDifferences, parseMarkdown, safeUrl, quoteMarker } from '../render/markdown';
import type { StructuralNode, SearchOptions, SearchMatch, InlineHtmlTag } from '../types';
import { findMatches } from '../search';
import { colorSyntax, type TextColor } from '../render/colors';
import { inlineHtmlSyntax, type InlineHtml } from '../render/inline-html';

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

function clipboardCells(slice: Slice): ProseNode[][] | null {
  let content = slice.content;
  while (content.childCount === 1 && content.firstChild?.type.spec.tableRole === 'table') content = content.firstChild.content;
  const nodes: ProseNode[] = [];
  content.forEach(node => nodes.push(node));
  if (nodes.length && nodes.every(node => node.type.spec.tableRole === 'row')) return nodes.map(row => {
    const cells: ProseNode[] = [];
    row.forEach(cell => cells.push(cell));
    return cells;
  });
  return nodes.length && nodes.every(node => ['cell', 'header_cell'].includes(String(node.type.spec.tableRole))) ? [nodes] : null;
}

export async function createVisual(
  element: HTMLElement,
  structures: readonly StructuralNode[],
  readOnly: () => boolean,
  changed: (markdown: string) => void,
  selectionChanged: () => void,
  documentBase?: string,
  allowTextColors = false,
  renderCode?: (code: string, language: string, element: HTMLElement, position: () => number | undefined, topLevel: boolean) => (() => void) | undefined,
  allowedHtml: readonly InlineHtmlTag[] = [],
): Promise<VisualEngine> {
  let editor: Editor;
  let replacing = false;
  let finalNewline = false;
  const pasteSpreadsheet = (view: EditorView, event: ClipboardEvent, slice: Slice): boolean => {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    let depth = view.state.selection.$from.depth;
    while (depth > 0 && view.state.selection.$from.node(depth).type.name !== 'table') depth--;
    if (readOnly() || view.state.selection.$from.parent.type.spec.code) return false;
    const htmlCells = event.clipboardData?.getData('text/html') ? clipboardCells(slice) : null;
    let rows: string[][];
    if (htmlCells && !text.includes('\t')) {
      rows = htmlCells.map(row => row.map(cell => cell.textBetween(0, cell.content.size, '\n', '\n')));
    } else {
      if (!text.includes('\t') && !(depth && /[\r\n]/.test(text))) return false;
      const parsed = Papa.parse<string[]>(text, { delimiter: '\t', skipEmptyLines: false });
      if (parsed.errors.length) return false;
      rows = parsed.data;
      if (rows.length > 1 && rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === '') rows.pop();
    }
    const width = Math.max(...rows.map(row => row.length));
    if (!width || (width < 2 && rows.length < 2 && !htmlCells)) return false;
    const { schema } = view.state;
    const tableRows = rows.map((row, index) => {
      const cells = Array.from({ length: width }, (_, column) => {
        const value = (row[column] ?? '').replace(/\r\n?|\n/g, ' ');
        const content = value ? [schema.text(value)] : [];
        return (index === 0 ? schema.nodes.table_header : schema.nodes.table_cell).createAndFill(null, schema.nodes.paragraph.create(null, content))!;
      });
      return (index === 0 ? schema.nodes.table_header_row : schema.nodes.table_row).create(null, cells);
    });
    if (!depth && tableRows.length === 1) tableRows.push(schema.nodes.table_row.create(null,
      Array.from({ length: width }, () => schema.nodes.table_cell.createAndFill()!)));
    const tableSlice = new Slice(Fragment.from(schema.nodes.table.create(null, tableRows)), 0, 0);
    if (depth) {
      const { table, tableStart, top, left } = selectedRect(view.state);
      const columns = Math.max(table.firstChild?.childCount ?? 0, left + width);
      const replacementRows = Array.from({ length: Math.max(table.childCount, top + rows.length) }, (_, rowIndex) => {
        const existing = rowIndex < table.childCount ? table.child(rowIndex) : null;
        const type = rowIndex === 0 ? schema.nodes.table_header : schema.nodes.table_cell;
        const cells = Array.from({ length: columns }, (_, column) => {
          const pasted = rowIndex >= top && rowIndex < top + rows.length && column >= left && column < left + width
            ? tableRows[rowIndex - top].child(column - left) : null;
          const previous = existing && column < existing.childCount ? existing.child(column) : null;
          return pasted ? type.create(previous?.attrs, pasted.content) : previous ?? type.createAndFill()!;
        });
        return (rowIndex === 0 ? schema.nodes.table_header_row : schema.nodes.table_row).create(existing?.attrs, cells);
      });
      const start = tableStart - 1;
      const replacementTable = table.type.create(table.attrs, replacementRows);
      const transaction = closeHistory(view.state.tr.replaceWith(start, start + table.nodeSize, replacementTable));
      if (view.state.selection instanceof CellSelection) {
        const map = TableMap.get(replacementTable);
        transaction.setSelection(CellSelection.create(transaction.doc,
          tableStart + map.positionAt(top, left, replacementTable),
          tableStart + map.positionAt(top + rows.length - 1, left + width - 1, replacementTable)));
      }
      view.dispatch(transaction.scrollIntoView());
    } else view.dispatch(closeHistory(view.state.tr.replaceSelection(tableSlice)).scrollIntoView());
    return true;
  };
  const renderedCodeBlocks = new WeakSet<Node>();
  const serialize = (node: ProseNode): string => {
    const markdown = editor.action(ctx => ctx.get(serializerCtx)(node)).replace(/\r\n?/g, '\n');
    if (finalNewline) return markdown || '\n';
    return markdown.endsWith('\n') ? markdown.slice(0, -1) : markdown;
  };
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
  const plugins = [history(), new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (readOnly() || view.composing || from !== to || text.includes('\n')) return false;
        const { state } = view;
        const code = state.schema.marks.inlineCode;
        const position = state.doc.resolve(from);
        if (position.parent.type.spec.code) return false;
        const marks = state.storedMarks ?? position.marks();
        const atCodeEnd = marks.some(mark => mark.type === code)
          && !position.nodeAfter?.marks.some(mark => mark.type === code);
        if (text === '`' && atCodeEnd) {
          view.dispatch(state.tr.removeStoredMark(code));
          return true;
        }
        if (atCodeEnd && state.storedMarks?.some(mark => mark.type === code)) {
          view.dispatch(state.tr.insertText(text, from, to).setStoredMarks(marks));
          return true;
        }
        if (text.includes('`') || marks.some(mark => mark.type === code)) return false;
        const offset = position.parentOffset;
        const before = position.parent.textBetween(0, offset, '\n', '\ufffc');
        const after = position.parent.textBetween(offset, position.parent.content.size, '\n', '\ufffc');
        if (!before.endsWith('`') || before.endsWith('``') || !after.startsWith('`') || after.startsWith('``')) return false;
        const backslashes = before.slice(0, -1).match(/\\+$/)?.[0].length ?? 0;
        if (backslashes % 2) return false;
        const transaction = state.tr.replaceWith(from - 1, to + 1, state.schema.text(text, [code.create()]));
        transaction.setSelection(TextSelection.create(transaction.doc, from - 1 + text.length));
        transaction.setStoredMarks([code.create()]);
        view.dispatch(transaction.scrollIntoView());
        return true;
      },
      handleKeyDown(view, event) {
        if (view.composing || event.key !== 'ArrowRight' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
        const { state } = view;
        if (!state.selection.empty) return false;
        const position = state.selection.$from;
        const code = state.schema.marks.inlineCode;
        if (!(state.storedMarks ?? position.marks()).some(mark => mark.type === code)
          || position.nodeAfter?.marks.some(mark => mark.type === code)) return false;
        view.dispatch(state.tr.removeStoredMark(code));
        return true;
      },
    },
  }), inputRules({ rules: [new InputRule(/^ {0,3}(`{3,}|~{3,})([^\s`~]*)\s$/, (state, match, start, end) => {
    if (state.selection.$from.parent.type.name !== 'paragraph') return null;
    return state.tr.delete(start, end).setBlockType(start, start, state.schema.nodes.code_block, { language: match[2] });
  }), new InputRule(/(?<![\w:/~])~~([^~]+)~~$/, (state, match, start, end) => {
    const mark = state.schema.marks.strike_through;
    return state.tr.insertText(match[1], start, end).addMark(start, start + match[1].length, mark.create()).removeStoredMark(mark);
  })] }), keymap({ ...baseKeymap, Enter: (state, dispatch, view) => {
    if (state.selection.$from.parent.type.spec.code) return baseKeymap.Enter(state, dispatch, view);
    const position = state.selection.$from;
    const fence = state.selection.empty && position.parent.type.name === 'paragraph'
      && position.parentOffset === position.parent.content.size
      ? position.parent.textContent.match(/^ {0,3}(`{3,}|~{3,})([^\s`~]*)$/) : null;
    if (fence) {
      dispatch?.(state.tr.delete(position.start(), position.end()).setBlockType(position.start(), position.start(), state.schema.nodes.code_block, { language: fence[2] }).scrollIntoView());
      return true;
    }
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
        if (node.type.name === 'paragraph' && node.childCount > 0) {
          let commentsOnly = true;
          node.forEach(child => {
            if (child.type.name !== 'html' || !/^\s*<!--[\s\S]*-->\s*$/.test(String(child.attrs.value))) commentsOnly = false;
          });
          if (commentsOnly) decorations.push(Decoration.node(position, position + node.nodeSize, { class: 'markian-comment-only' }));
        }
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
    ctx.update(remarkStringifyOptionsCtx, options => ({ ...options, bullet: '-' as const }));
    ctx.update(remarkStringifyOptionsCtx, options => ({ ...options, handlers: { ...options.handlers,
      inlineHtml: (node: InlineHtml, _parent: unknown, state: MarkdownState, info: Info) => `<${node.tag}>${state.containerPhrasing(node, info)}</${node.tag}>`,
    } }));
    if (allowTextColors) ctx.update(remarkStringifyOptionsCtx, options => ({ ...options, handlers: { ...options.handlers,
      textColor: (node: TextColor, _parent: unknown, state: MarkdownState, info: Info) => `<span style="color:${node.color}">${state.containerPhrasing(node, info)}</span>`,
    } }));
    ctx.update(prosePluginsCtx, current => [...current, ...plugins]);
    ctx.update(editorViewOptionsCtx, options => ({
      ...options,
      attributes: { class: 'markian-document', 'aria-label': 'Markdown document', role: 'textbox', 'aria-multiline': 'true' },
      editable: () => !readOnly(),
      clipboardTextSerializer(slice) {
        const cells = clipboardCells(slice);
        return cells ? Papa.unparse(cells.map(row => row.map(cell => cell.textBetween(0, cell.content.size, '\n', '\n'))), { delimiter: '\t', newline: '\r\n' })
          : slice.content.textBetween(0, slice.content.size, '\n\n');
      },
      handlePaste: pasteSpreadsheet,
      handleKeyDown(view, event) {
        if (view.composing || !['Backspace', 'Delete'].includes(event.key) || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
        const { state } = view;
        if (!(state.selection instanceof TextSelection) || !state.selection.empty) return false;
        const position = state.selection.$from;
        const backward = event.key === 'Backspace';
        if (position.parentOffset !== (backward ? 0 : position.parent.content.size) || position.depth === 0) return false;
        const boundary = backward ? position.before() : position.after();
        const adjacent = backward ? state.doc.resolve(boundary).nodeBefore : state.doc.resolve(boundary).nodeAfter;
        if (!adjacent) return false;
        const start = backward ? boundary - adjacent.nodeSize : boundary;
        const dom = view.nodeDOM(start);
        if (adjacent.type.name !== 'table' && (!dom || !renderedCodeBlocks.has(dom))) return false;
        if (!readOnly()) view.dispatch(closeHistory(state.tr.delete(start, start + adjacent.nodeSize)).scrollIntoView());
        return true;
      },
      nodeViews: { ...options.nodeViews, code_block: (node, _view, getPos) => {
        const dom = element.ownerDocument.createElement('pre');
        const content = element.ownerDocument.createElement('code');
        content.className = `language-${String(node.attrs.language ?? '')}`;
        dom.append(content);
        const position = getPos();
        const topLevel = position !== undefined && _view.state.doc.resolve(position).depth === 0;
        const dispose = renderCode?.(node.textContent, String(node.attrs.language ?? ''), dom, getPos, topLevel);
        if (dispose) renderedCodeBlocks.add(dom);
        return dispose ? { dom, destroy: dispose, stopEvent: () => true, ignoreMutation: () => true }
          : { dom, contentDOM: content };
      } },
      dispatchTransaction(transaction) {
        const view = ctx.get(editorViewCtx);
        const result = view.state.applyTransaction(transaction);
        view.updateState(result.state);
        if (!replacing && result.transactions.some(item => item.docChanged)) changed(serialize(view.state.doc));
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
  if (allowedHtml.length) {
    editor.use($remark('markian-inline-html', () => inlineHtmlSyntax(allowedHtml)));
    for (const tag of allowedHtml) editor.use($mark(`html_${tag}`, () => ({
      inclusive: true,
      parseDOM: [{ tag, getAttrs: node => (node as HTMLElement).attributes.length ? false : {} }],
      toDOM: () => [tag, 0],
      parseMarkdown: {
        match: node => node.type === 'inlineHtml' && node.tag === tag,
        runner: (state, node, type) => { state.openMark(type); state.next(node.children); state.closeMark(type); },
      },
      toMarkdown: { match: mark => mark.type.name === `html_${tag}`, runner: (state, mark) => { state.withMark(mark, 'inlineHtml', undefined, { tag }); } },
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
  const parse = (markdown: string): ProseNode => {
    parseMarkdown(markdown);
    const node = editor.action(ctx => ctx.get(parserCtx)(markdown));
    if (!safeDocument(node)) throw new Error('Unsafe URLs cannot be opened in visual mode. Source has been retained.');
    const serialized = serialize(node);
    if (!equivalentMarkdown(markdown, serialized, allowedHtml)) {
      throw new Error('This document contains content not supported by visual mode. Source has been retained. First round-trip differences: ' + markdownDifferences(markdown, serialized).join(' '));
    }
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
      finalNewline = /[\r\n]$/.test(markdown);
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