import { Editor, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, parserCtx, serializerCtx, prosePluginsCtx, rootCtx } from '@milkdown/kit/core';
import { commonmark, htmlSchema } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { $node } from '@milkdown/kit/utils';
import type { RootContent } from 'mdast';
import { baseKeymap, history, keymap, Plugin, redo, undo, EditorState, type EditorView, type ProseNode } from './prose';
import { equivalentMarkdown, parseMarkdown, safeUrl } from '../render/markdown';
import type { StructuralNode } from '../types';

export interface VisualEngine {
  view: EditorView;
  parse(markdown: string): ProseNode;
  serialize(node: ProseNode): string;
  replace(markdown: string, reset: boolean): void;
  setReadOnly(value: boolean): void;
  destroy(): Promise<void>;
}

function safeDocument(node: ProseNode): boolean {
  let safe = true;
  node.descendants(child => {
    if (child.type.name === 'image' && !safeUrl(String(child.attrs.src), true)) safe = false;
    if (child.marks.some(mark => mark.type.name === 'link' && !safeUrl(String(mark.attrs.href)))) safe = false;
  });
  return safe;
}

export async function createVisual(
  element: HTMLElement,
  structures: readonly StructuralNode[],
  readOnly: () => boolean,
  changed: (markdown: string) => void,
): Promise<VisualEngine> {
  let editor: Editor;
  let replacing = false;
  const plugins = [history(), keymap({ 'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo, ...baseKeymap }), new Plugin({
    filterTransaction: transaction => !transaction.docChanged || (safeDocument(transaction.doc) && (replacing || !readOnly())),
  })];
  editor = Editor.make().config(ctx => {
    ctx.set(rootCtx, element);
    ctx.set(defaultValueCtx, '');
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
      },
      handleDOMEvents: {
        click: (_view, event) => {
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
  editor.use(commonmark).use(gfm).use(htmlSchema.extendSchema(previous => ctx => ({
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
    setReadOnly: () => view.setProps({ editable: () => !readOnly() }),
    destroy: async () => { await editor.destroy(); },
  };
}