import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Root, RootContent } from 'mdast';
import type { State as HastState } from 'mdast-util-to-hast';
import type { Element as HastElement, Root as HastRoot, RootContent as HastContent } from 'hast';
import { colorSyntax, type TextColor } from './colors';

export const documentLimit = 1_000_000;

export function quoteMarker(text: string): { kind: string; length: number } | null {
  const marker = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\r?\n|$)/);
  return marker ? { kind: marker[1], length: marker[0].length } : null;
}

export function validateMarkdown(markdown: string): void {
  if (typeof markdown !== 'string') throw new TypeError('Markdown must be a string.');
  if (markdown.length > documentLimit) throw new RangeError(`Markdown exceeds ${documentLimit} characters.`);
}

export function parseMarkdown(markdown: string): Root {
  validateMarkdown(markdown);
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml', 'toml']).use(colorSyntax);
  return processor.runSync(processor.parse(markdown)) as Root;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['position', 'data', 'spread'].includes(key))
      .map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

export function equivalentMarkdown(first: string, second: string): boolean {
  return JSON.stringify(canonical(parseMarkdown(first.replace(/\r\n?/g, '\n')))) === JSON.stringify(canonical(parseMarkdown(second.replace(/\r\n?/g, '\n'))));
}

export function markdownDifferences(first: string, second: string): string[] {
  const differences: string[] = [];
  const describe = (value: unknown): string => {
    const text = JSON.stringify(canonical(value)) ?? 'missing';
    return text.length > 100 ? text.slice(0, 97) + '...' : text;
  };
  const visit = (original: unknown, serialized: unknown, path: string, startLine: number, endLine: number): void => {
    if (differences.length >= 5 || JSON.stringify(canonical(original)) === JSON.stringify(canonical(serialized))) return;
    if (original && typeof original === 'object' && !Array.isArray(original)) {
      const position = (original as { position?: Root['position'] }).position;
      startLine = position?.start.line ?? startLine;
      endLine = position?.end.line ?? endLine;
    }
    if (Array.isArray(original) && Array.isArray(serialized)) {
      for (let index = 0; index < Math.max(original.length, serialized.length) && differences.length < 5; index++) {
        visit(original[index], serialized[index], `${path}[${index}]`, original[index] === undefined ? endLine : startLine, endLine);
      }
      return;
    }
    if (original && serialized && typeof original === 'object' && typeof serialized === 'object'
      && !Array.isArray(original) && !Array.isArray(serialized)) {
      const originalFields = original as Record<string, unknown>;
      const serializedFields = serialized as Record<string, unknown>;
      for (const key of new Set([...Object.keys(originalFields), ...Object.keys(serializedFields)])) {
        if (!['position', 'data', 'spread'].includes(key)) visit(originalFields[key], serializedFields[key], `${path}.${key}`, startLine, endLine);
      }
      return;
    }
    const location = startLine === endLine ? `Line ${startLine}` : `Lines ${startLine}-${endLine}`;
    differences.push(`${location}: ${path} changed from ${describe(original)} to ${describe(serialized)}.`);
  };
  visit(parseMarkdown(first.replace(/\r\n?/g, '\n')), parseMarkdown(second.replace(/\r\n?/g, '\n')), 'document', 1, 1);
  return differences;
}

export function safeUrl(destination: string, image = false): boolean {
  const compact = destination.replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
  if (compact.startsWith('//') || compact.includes('\\')) return false;
  if (image && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(compact)) {
    return compact.length <= 2_000_000;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(compact)) return /^(https?:|mailto:)/i.test(compact) && (!image || /^https?:/i.test(compact));
  return true;
}

function textContent(node: Root | RootContent): string {
  if ('value' in node) return node.value;
  return 'children' in node ? node.children.map(child => textContent(child as RootContent)).join('') : '';
}

export interface Heading {
  id: string;
  label: string;
  depth: number;
  line: number;
}

export function headings(markdown: string): Heading[] {
  const used = new Set<string>();
  const found: Heading[] = [];
  const visit = (node: Root | RootContent): void => {
    if (node.type !== 'heading') {
      if ('children' in node) node.children.forEach(child => visit(child as RootContent));
      return;
    }
    const label = textContent(node);
    const base = label.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    let id = base;
    let suffix = 0;
    while (used.has(id)) id = `${base}-${++suffix}`;
    used.add(id);
    found.push({ id, label, depth: node.depth, line: node.position?.start.line ?? 1 });
  };
  visit(parseMarkdown(markdown));
  return found;
}

export function renderMarkdown(markdown: string, softbreaks = false, allowTextColors = false): string {
  const anchors = headings(markdown);
  let headingIndex = 0;
  return String(unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(colorSyntax)
    .use(() => (tree: Root) => {
      const walk = (node: Root | RootContent): void => {
        if (node.type === 'heading') node.data = { hProperties: { id: anchors[headingIndex++].id } };
        if (node.type === 'blockquote') {
          const paragraph = node.children[0];
          const text = paragraph?.type === 'paragraph' ? paragraph.children[0] : undefined;
          const marker = text?.type === 'text' ? quoteMarker(text.value) : null;
          if (marker && text?.type === 'text' && paragraph?.type === 'paragraph') {
            text.value = text.value.slice(marker.length);
            if (!text.value) {
              paragraph.children.shift();
              if (paragraph.children[0]?.type === 'break') paragraph.children.shift();
            }
            if (!paragraph.children.length) node.children.shift();
            node.data = { hProperties: { dataAlertKind: marker.kind.toLowerCase(), dataAlertTitle: marker.kind[0] + marker.kind.slice(1).toLowerCase() } };
          }
        }
        if ((node.type === 'link' || node.type === 'image') && !safeUrl(node.url, node.type === 'image')) node.url = '';
        if ('children' in node) {
          if (softbreaks) node.children = node.children.flatMap((child): RootContent[] => child.type === 'text' && child.value.includes('\n')
            ? child.value.split(/\r?\n/).flatMap((value, index): RootContent[] => index ? [{ type: 'break' }, { type: 'text', value }] : [{ type: 'text', value }])
            : [child]) as typeof node.children;
          node.children.forEach(child => walk(child as RootContent));
        }
      };
      walk(tree);
    })
    .use(remarkRehype, { handlers: {
      textColor: (state: HastState, node: TextColor): HastElement => ({ type: 'element', tagName: 'span', properties: allowTextColors ? { style: `color: ${node.color}` } : {}, children: state.all(node) }),
    } })
    .use(() => (tree: HastRoot) => {
      const walk = (node: HastRoot | HastContent): void => {
        if (node.type === 'element') {
          for (const attribute of ['href', 'src'] as const) {
            const value = node.properties[attribute];
            if (typeof value === 'string' && !safeUrl(value, attribute === 'src')) delete node.properties[attribute];
          }
        }
        if ('children' in node) node.children.forEach(walk);
      };
      walk(tree);
    })
    .use(rehypeSanitize, { ...defaultSchema, protocols: { ...defaultSchema.protocols, src: [...(defaultSchema.protocols?.src ?? []), 'data'] }, clobberPrefix: '', attributes: { ...defaultSchema.attributes, blockquote: ['dataAlertKind', 'dataAlertTitle'], span: allowTextColors ? ['style'] : [], '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id'] } })
    .use(rehypeStringify)
    .processSync(markdown));
}