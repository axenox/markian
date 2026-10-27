import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';

export interface TextColor extends Parent {
  type: 'textColor';
  color: string;
  children: PhrasingContent[];
}

declare module 'mdast' {
  interface PhrasingContentMap { textColor: TextColor; }
  interface RootContentMap { textColor: TextColor; }
}

export const defaultColors = ['#262c2b', '#a82736', '#a65b00', '#227761', '#16669a', '#754491'];

export function colorSyntax() {
  return (tree: Root): void => {
    const visit = (parent: Root | RootContent): void => {
      if (!('children' in parent)) return;
      const children = parent.children as RootContent[];
      for (let index = 0; index < children.length; index++) {
        const opening = children[index];
        if (opening.type !== 'html') continue;
        const match = opening.value.match(/^<span style="color:\s*(#[a-f0-9]{6});?">$/i);
        if (!match) continue;
        let nesting = 1;
        let end = index + 1;
        for (; end < children.length; end++) {
          const node = children[end];
          if (node.type !== 'html') continue;
          if (/^<span\b/i.test(node.value)) nesting++;
          if (/^<\/span\s*>$/i.test(node.value) && --nesting === 0) break;
        }
        if (end === children.length) continue;
        const content = children.slice(index + 1, end);
        if (content.some(node => !['text', 'emphasis', 'strong', 'delete', 'inlineCode', 'link', 'break', 'image', 'textColor'].includes(node.type))) continue;
        const color: TextColor = { type: 'textColor', color: match[1].toLowerCase(), children: content as PhrasingContent[] };
        visit(color);
        children.splice(index, end - index + 1, color);
      }
      children.forEach(visit);
    };
    visit(tree);
  };
}