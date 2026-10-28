import { EditorInstance } from './editor';
import type { EditorOptions, ExtensionFactory, MarkianInstance } from './types';

const factories = new Map<string, ExtensionFactory>();
const mounted = new WeakMap<HTMLElement, MarkianInstance>();
const scriptUrl = typeof document === 'undefined' ? undefined : (document.currentScript as HTMLScriptElement | null)?.src;

export function registerExtension(id: string, factory: ExtensionFactory): void {
  if (!id || factories.has(id)) throw new Error(`Duplicate or empty extension ID: ${id}`);
  if (typeof factory !== 'function') throw new TypeError('Extension factory must be a function.');
  factories.set(id, factory);
}

export function create(element: HTMLElement, options: EditorOptions): MarkianInstance {
  if (mounted.has(element)) throw new Error('This host already has an editor. Destroy it before remounting.');
  const markdownCssUrls = options.markdownCssUrls ?? (scriptUrl ? [new URL('markdown-github.css', scriptUrl).href] : undefined);
  if (!markdownCssUrls) throw new Error('Specify markdownCssUrls when loading Markian without a classic script URL.');
  const editor = new EditorInstance(element, { ...options, markdownCssUrls }, factories);
  editor.element.toggleAttribute('data-markian-markdown-default', options.markdownCssUrls === undefined);
  mounted.set(element, editor);
  const destroy = editor.destroy.bind(editor);
  editor.destroy = () => { destroy(); mounted.delete(element); };
  return editor;
}

export const version = '0.1.0';
export type * from './types';