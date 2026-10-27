import { EditorInstance } from './editor';
import type { EditorOptions, ExtensionFactory, MarkianInstance } from './types';

const factories = new Map<string, ExtensionFactory>();
const mounted = new WeakMap<HTMLElement, MarkianInstance>();

export function registerExtension(id: string, factory: ExtensionFactory): void {
  if (!id || factories.has(id)) throw new Error(`Duplicate or empty extension ID: ${id}`);
  if (typeof factory !== 'function') throw new TypeError('Extension factory must be a function.');
  factories.set(id, factory);
}

export function create(element: HTMLElement, options: EditorOptions): MarkianInstance {
  if (mounted.has(element)) throw new Error('This host already has an editor. Destroy it before remounting.');
  const editor = new EditorInstance(element, options, factories);
  mounted.set(element, editor);
  const destroy = editor.destroy.bind(editor);
  editor.destroy = () => { destroy(); mounted.delete(element); };
  return editor;
}

export const version = '0.1.0';
export type * from './types';