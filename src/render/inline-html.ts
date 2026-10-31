/** Attribute-free inline HTML mappings; unsupported HTML remains opaque source. */
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';
export type InlineHtmlTag = 'kbd' | 'sub' | 'sup' | 'mark';

export function validateInlineHtml(allowed: readonly InlineHtmlTag[] = []): void {
  if (!Array.isArray(allowed) || allowed.some(tag => !['kbd', 'sub', 'sup', 'mark'].includes(tag)) || new Set(allowed).size !== allowed.length) throw new TypeError('allowedHtml accepts unique kbd, sub, sup and mark tags only.');
}

export interface InlineHtml extends Parent {
  type: 'inlineHtml';
  tag: InlineHtmlTag;
  children: PhrasingContent[];
}
declare module 'mdast' {
  interface PhrasingContentMap { inlineHtml: InlineHtml; }
  interface RootContentMap { inlineHtml: InlineHtml; }
}

export function inlineHtmlSyntax(allowed: readonly InlineHtmlTag[]) {
  return () => (tree: Root): void => {
    const visit = (parent: Root | RootContent): void => {
      if (!('children' in parent)) return;
      const children = parent.children as RootContent[];
      for (let index = 0; index < children.length; index++) {
        const opening = children[index];
        if (opening.type !== 'html') continue;
        const tag = opening.value.match(/^<(kbd|sub|sup|mark)>$/)?.[1] as InlineHtmlTag | undefined;
        if (!tag || !allowed.includes(tag)) continue;
        let depth = 1;
        let end = index + 1;
        for (; end < children.length; end++) {
          const node = children[end];
          if (node.type !== 'html') continue;
          if (node.value === `<${tag}>`) depth++;
          if (node.value === `</${tag}>` && --depth === 0) break;
        }
        if (end === children.length) continue;
        const content = children.slice(index + 1, end);
        if (content.some(node => !['text', 'emphasis', 'strong', 'delete', 'inlineCode', 'break', 'html', 'inlineHtml'].includes(node.type))) continue;
        const node: InlineHtml = { type: 'inlineHtml', tag, children: content as PhrasingContent[] };
        visit(node);
        if (node.children.some(child => child.type === 'html')) continue;
        children.splice(index, end - index + 1, node);
      }
      children.forEach(visit);
    };
    visit(tree);
  };
}