/** Literal template expansion and the bounded inline HTML policy shared with rendering. */
import type { InlineHtmlTag, TemplateDefinition } from './types';
import { parseMarkdown } from './render/markdown';
import type { Root, RootContent } from 'mdast';
import { closeHistory, Slice, TextSelection } from './engines/prose';
import type { VisualEngine } from './engines/visual';
import type { SourceEditor } from './engines/source';
import type { EditorOptions, MarkianInstance } from './types';
import { validateInlineHtml } from './render/inline-html';
import { defaultToolbar } from './ui/toolbar';
import { templateStyles } from './render/template-styles';

export const inlineHtmlTags: readonly InlineHtmlTag[] = ['kbd', 'sub', 'sup', 'mark'];

export function validateTemplates(templates: readonly TemplateDefinition[] = [], allowedHtml: readonly InlineHtmlTag[] = []): void {
  validateInlineHtml(allowedHtml);
  templateStyles(templates);
  if (!Array.isArray(templates)) throw new TypeError('templates must be an array.');
  const ids = new Set<string>();
  for (const template of templates) {
    if (!template || !/^[\w-]{1,60}$/.test(template.id) || ids.has(template.id) || typeof template.label !== 'string' || !template.label.trim()) throw new TypeError('Templates require unique IDs and nonempty labels.');
    ids.add(template.id);
    if (template.hint !== undefined && typeof template.hint !== 'string' || template.icon !== undefined && typeof template.icon !== 'string') throw new TypeError('Template hints and icons must be strings.');
    expandTemplate(template.markdown, '', allowedHtml);
  }
}

export function expandTemplate(markdown: string, selection: string, allowedHtml: readonly InlineHtmlTag[] = []): { markdown: string; caret?: number } {
  const tree = parseMarkdown(markdown);
  const token = '{{selection}}';
  const positions: number[] = [];
  for (let offset = markdown.indexOf(token); offset !== -1; offset = markdown.indexOf(token, offset + token.length)) positions.push(offset);
  const contexts = new Map<number, 'text' | 'code'>();
  const visit = (node: Root | RootContent): void => {
    if (node.type === 'html') {
      if (!new RegExp(`^</?(?:${allowedHtml.join('|') || '(?!)'})>$`).test(node.value)) throw new TypeError('Templates permit only configured inline HTML tags without attributes.');
    }
    if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') {
      for (const position of positions) if (position >= (node.position?.start.offset ?? 0) && position < (node.position?.end.offset ?? 0)) contexts.set(position, node.type === 'text' ? 'text' : 'code');
    }
    if ('children' in node) node.children.forEach(child => visit(child as RootContent));
  };
  visit(tree);
  if (positions.some(position => !contexts.has(position))) throw new TypeError('Template selection placeholders are not supported in HTML attributes, destinations or metadata.');
  let result = '';
  let previous = 0;
  let caret: number | undefined;
  for (const position of positions) {
    result += markdown.slice(previous, position);
    caret ??= result.length;
    if (contexts.get(position) === 'code') {
      if (/[`\r\n]/.test(selection)) throw new TypeError('Code template selections cannot contain backticks or line breaks.');
      result += selection;
    } else result += selection.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()!#|~+.=\-]/g, '\\$&');
    previous = position + token.length;
  }
  result += markdown.slice(previous);
  return { markdown: result, caret: selection ? undefined : caret };
}

export function installTemplates(instance: MarkianInstance, options: EditorOptions, visual: () => VisualEngine, raw: () => SourceEditor): void {
  if (!options.templates?.length) return;
  const commands = options.templates.map(template => {
    const id = `template:${template.id}`;
    instance.getCommands().insert({ id, label: template.label, icon: template.icon ?? 'code', hint: template.hint, views: ['visual', 'raw'], mutates: true,
      run: () => {
        if (instance.activeView === 'raw') {
          const view = raw().view;
          const { from, to } = view.state.selection.main;
          const result = expandTemplate(template.markdown, view.state.sliceDoc(from, to), options.allowedHtml);
          view.dispatch({ changes: { from, to, insert: result.markdown }, selection: { anchor: from + (result.caret ?? result.markdown.length) } });
          view.focus();
          return;
        }
        const engine = visual();
        const view = engine.view;
        const { from, to, empty } = view.state.selection;
        const result = expandTemplate(template.markdown, view.state.doc.textBetween(from, to, '\n'), options.allowedHtml);
        const wrapper = empty ? template.markdown.match(/^<(kbd|sub|sup|mark)>\{\{selection\}\}<\/\1>$/) : null;
        if (wrapper) {
          view.dispatch(view.state.tr.addStoredMark(view.state.schema.marks[`html_${wrapper[1]}`].create()));
        } else {
          const marker = empty && result.caret !== undefined ? `MarkianCaret${crypto.randomUUID().replace(/-/g, '')}` : undefined;
          const doc = engine.parse(marker ? expandTemplate(template.markdown, marker, options.allowedHtml).markdown : result.markdown);
          const slice = Slice.maxOpen(doc.content);
          const transaction = closeHistory(view.state.tr.replaceSelection(slice));
          if (marker) {
            const positions: number[] = [];
            transaction.doc.descendants((node, position) => {
              if (!node.isText) return;
              for (let offset = node.text!.indexOf(marker); offset !== -1; offset = node.text!.indexOf(marker, offset + marker.length)) positions.push(position + offset);
            });
            for (const position of [...positions].reverse()) transaction.delete(position, position + marker.length);
            if (positions.length) transaction.setSelection(TextSelection.near(transaction.doc.resolve(positions[0])));
          }
          view.dispatch(transaction.scrollIntoView());
        }
        view.focus();
      },
    });
    return id;
  });
  instance.getCommands().insert({ id: 'templates', label: 'Templates', icon: 'templates', views: ['visual', 'raw'], mutates: true, run: () => {} });
  const toolbar = instance.getToolbar();
  const group = (options.toolbar ?? defaultToolbar).find(entry => typeof entry !== 'string' && entry.id === 'insert');
  const beforeRule = typeof group !== 'string' && group?.items?.some(entry => (typeof entry === 'string' ? entry : entry.id) === 'rule') ? 'rule' : undefined;
  toolbar.insert({ id: 'templates', type: 'menu', items: commands }, 'insert', beforeRule);
}